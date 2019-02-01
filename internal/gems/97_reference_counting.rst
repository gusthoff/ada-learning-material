:orphan:

:code-config:`run_button=False;prove_button=False;accumulate_code=False`
:code-config:`reset_accumulator=True`

Reference Counting
==================

.. include:: <isopub.txt>

.. role:: ada(code)
   :language: ada

.. role:: c(code)
   :language: c

.. role:: cpp(code)
   :language: c++

Original Gems:

    - `Gem #97: Reference Counting in Ada - Part 1 <https://www.adacore.com/gems/gem-97-reference-counting-in-ada-part-1>`_
    - `Gem #99: Reference Counting in Ada - Part 2: Task Safety <https://www.adacore.com/gems/gem-99-reference-counting-in-ada-part-2-task-safety>`_
    - `Gem #100: Reference Counting in Ada - Part 3: Weak References <https://www.adacore.com/gems/gem-100-reference-counting-in-ada-part-3-weak-references>`_
    - `Gem #107: Preventing Deallocation for Reference-counted Types by Ada Magica <https://www.adacore.com/gems/gem-107-preventing-deallocation-for-reference-counted-types>`_


Gem #97: Reference Counting in Ada |mdash| Part 1
-------------------------------------------------

Memory management is typically a complex issue to address when creating an
application, and even more so when creating a library to be reused by
third-party applications. It is necessary to document which part of the
code allocates memory and which part is supposed to free that memory. As
we have seen in a previous Gem, a number of tools exist for detecting
memory leaks (:program:`gnatmem`, :ada:`GNATCOLL.Memory` or
:program:`valgrind`). But of course, it would be more convenient if the
memory were automatically managed.

Some languages include an automatic garbage collector. The Ada Reference
Manual has an implementation permission allowing a conformant compiler to
provide one, although none of the mainstream compilers do so. Ada's design
allows implementations to use the stack in many situations where other
languages use the heap; this reduces the need for a garbage collector.

An alternative implementation for getting automatic memory management is
to use reference counting: every time some object is allocated, a counter
is associated with it. This counter records how many references to that
object exist. When that counter goes down to zero, it means the object is
no longer referenced in the application and can therefore be safely
deallocated.

The rest of this Gem will show how to implement such a mechanism in Ada.
As we will see, there are a number of minor but delicate issues involved,
so implementing such types is not as trivial as it first seems. The GNAT
Components Collection (GNATcoll) now includes a reusable generic package
that simplifies this, and we will discuss this briefly at the end of this
Gem.

As stated above, we need to associate a counter with the objects of all
types we want to monitor. The simplest is to create a tagged type
hierarchy where the root type defines the counter:

.. code-block:: ada

       type Refcounted is abstract tagged private;
       procedure Free (Self : in out Refcounted) is null;

    private

       type Refcounted is abstract tagged record
          Refcount : Integer := 0;
       end record;

This approach is mostly suitable when building a reusable library for
reference-counted types, such as GNATcoll. If you just want to do this
once or twice in your application, you can simply add a new
:ada:`Refcount` field to your record type (which doesn't need to be
tagged).

Next, we need to determine when to increment and decrement this counter.
In some languages this counter needs to be manually modified by the
application whenever a new reference is created, or when one is destroyed.
This is, for instance, how the Python interpreter is written (in C). But
we can do better in Ada, by taking advantage of controlled types. The
compiler calls special primitive operations each time a value of such a
type is created, copied, or destroyed.

If we wrap a component of a simple access type in a type derived from
:ada:`Ada.Finalization.Controlled`, we can then have the compiler
automatically increment or decrement the reference count of the designated
entity each time a reference is established or removed. We thus create a
smart pointer: a pointer that manages the life cycle of the block of
memory it points to.

.. code-block:: ada

       type Refcounted_Access is access all Refcounted'Class;
       type Ref is tagged private;

       procedure Set (Self : in out Ref; Data : Refcounted'Class);
       function Get (Self : Ref) return Refcounted_Access;
       procedure Finalize (P : in out Ref);
       procedure Adjust   (P : in out Ref);

    private

       type Ref is new Ada.Finalization.Controlled with record
           Data : Refcounted_Access;
       end record;

Let's first see how a user would use the type. Note that :ada:`Get`
returns an access to the data. This might be dangerous, since the caller
might want to free the data (which should remain under control of
:ada:`Ref`). In practice, the gain in efficiency is worth it, since it
avoids making a copy of a :ada:`Refcounted'Class` object. This is also
essential if we want to allow the user to easily modify the designated
entity. The user is ultimately responsible for ensuring that the lifetime
of the returned value is compatible with the lifetime of the corresponding
smart pointer.

.. code-block:: ada

    declare
      type My_Data is new Refcounted with record
         Field1 : ...;
      end record;

      R1 : Ref;

    begin
      Set (R1, My_Data'(Refcounted with Field1 => ...));
      --  R1 holds a reference to the data

      declare
         R2 : Ref;
      begin
         R2 := R1;
         --  R2 also holds a reference to the data (thus 2 references)

         ...
         --  We now exit the block. R2 is finalized, thus only 1 ref left

      end;

      Put_Line (My_Data (Get (R1).all).Field1);
      --  In practice, the smart pointers would be implemented in a generic package,
      --  and Get would return an access to My_Data, so we could write the simpler:
      --
      --     Put_Line (Get (R1).Field1);

      --  We now leave R1's scope, thus refcount is 0, and the data is freed.
    end;

Now let's look at the details of the implementation. First consider the
two subprograms for setting and getting the designated entity. Note that
the default value for the reference count is zero in the :ada:`Refcounted`
type. The implementation of :ada:`Set` is slightly tricky: it needs to
decrement the reference count of the previously designated entity, and
increment the reference count for the new data. Instead of calling
:ada:`Adjust` and :ada:`Finalize` explicitly (which is not a recommended
practice when it can be avoided), we use an aggregate and let the compiler
generate the calls for us.

.. code-block:: ada

    procedure Set (Self : in out Ref; Data : Refcounted'Class) is
      D : constant Refcounted_Access := new Refcounted'Class'(Data);
    begin
      if Self.Data /= null then
          Finalize (Self); -- decrement old reference count
      end if;

      Self.Data := D;
      Adjust (Self);  -- increment reference count (set to 1)
    end Set;

    function Get (P : Ref) return Refcounted_Access is
    begin
       return P.Data;
    end Get;

In :ada:`GNATCOLL.Refcount`, we provide a version of :ada:`Set` that
receives an existing access to :ada:`Refcount'Class`, and takes
responsibility for freeing it when it is no longer needed. The
implementation is very similar to the above (although we need to be
careful that we do not :ada:`Finalize` the old data if it happens to be
the same as the new, since otherwise we might end up freeing the memory).

:ada:`Adjust` is called every time a new reference is created. Nothing
special here:

.. code-block:: ada

    overriding procedure Adjust (P : in out Ref) is
    begin
       if P.Data /= null then
          P.Data.Refcount := P.Data.Refcount + 1;
       end if;
    end Adjust;

The implementation of :ada:`Finalize` is slightly more complicated: the
Ada reference manual indicates that a :ada:`Finalize` procedure should
always be idempotent. An Ada compiler is free to call :ada:`Finalize`
multiple times on the same object, in particular when exceptions occur.
This means we must be careful not to decrement the reference counter every
time :ada:`Finalize` is called, since a given object only owns one
reference. Hence the following implementation:

.. code-block:: ada

    overriding procedure Finalize (P : in out Ref) is
       Data : Refcounted_Access := P.Data;
    begin
       --  Idempotence: the next call to Finalize will have no effect
       P.Data := null;

       if Data /= null then
          Data.Refcount := Data.Refcount - 1;
          if Data.Refcount = 0 then
             Free (Data.all);  --  Call to user-defined primitive
             Unchecked_Free (Data);
          end if;
       end if;

    end Finalize;

That's it for the basic implementation. The next Gem in this series will
discuss issues of task safety associated with reference-counted types.

Gem #99: Reference Counting in Ada |mdash| Part 2: Task Safety
--------------------------------------------------------------

In Part 1, we described a reference-counted type that automatically frees
memory when the last reference to it disappears. But this type is not task
safe: when we decrement the counter, it might happen that two tasks see it
as 0, and thus both will try to free the data. Likewise, the increment of
the counter in :ada:`Adjust` is not an atomic operation, so it is possible
that we will be missing some references.

In some applications this restriction is not a big issue (for instance, if
there are no tasks, or if the types are only ever used from a single
task). However, let's try to improve the situation.

The traditional solution is to use a lock while we are manipulating the
counter. We could, for instance, use a protected type for this. However,
this means that a nontasking application using our reference-counted types
would have to initialize the whole tasking run-time, which could impact
execution somewhat, since part of the code goes through slower code paths.

GNAT provides a global lock that we can reuse for that, and that does not
require the full tasking run-time. We could use that lock in a function
that changes the value of the counter atomically. We need to return the
new value from that function: changing the value atomically solves the
problem we highlighted for :ada:`Adjust`, but not the one we showed for
:ada:`Finalize`, where two tasks could see the value as 0 if they read it
separately.

.. code-block:: ada

    function Atomic_Add
      (Ptr : access Integer; Inc : Integer) return Integer
    is
       Result : Integer;
    begin
       GNAT.Task_Lock.Lock;
       Ptr.all := Ptr.all + Value;
       Result := Ptr.all;
       GNAT.Task_Lock.Unlock;
       return Result;
    end Atomic_Add;

On some systems there is actually a more efficient way to do this, by
using an intrinsic function: this is a function provided by the compiler,
generally implemented directly in assembly language using low-level
capabilities of the target machine. We need special handling to check
whether this facility is available, but if it is, we no longer need a
lock. The :ada:`GNATCOLL.Refcount` package takes full advantage of this.

.. code-block:: ada

    function Atomic_Add
      (Ptr : access Integer; Inc : Integer) return Integer
    is
       function Intrinsic_Sync_Add_And_Fetch
         (Ptr   : access Interfaces.Integer_32;
          Value : Interfaces.Integer_32) return Interfaces.Integer_32;
       pragma Import
         (Intrinsic, Intrinsic_Sync_Add_And_Fetch, "__sync_add_and_fetch_4");
    begin
       return Intrinsic_Sync_Add_And_Fetch (Ptr, Value);
    end Atomic_Add;

(Note: In actual practice, it would be necessary to declare the access
parameter of function :ada:`Atomic_Add` with type
:ada:`Interfaces.Integer_32`, for type compatibility with the intrinsic.)

Once we have this :ada:`Atomic_Add` function we need to modify our
reference-counted type implementation. The first change is to declare the
:ada:`Refcount` field as aliased, in the definition of :ada:`Refcounted`.
We then revise the code as follows:

.. code-block:: ada

    overriding procedure Adjust (P : in out Ref) is
       Dummy : Integer;
    begin
       if P.Data /= null then
          Dummy := Atomic_Add (P.Data.Refcount'Access, 1);
       end if;
    end Adjust;

    overriding procedure Finalize (P : in out Ref) is
       Data : Refcounted_Access := P.Data;
    begin
       P.Data := null;
       if Data /= null
          and then Atomic_Add (Data.Refcount'Access, -1) = 0
       then
          Free (Data.all);
          Unchecked_Free (Data);
       end if;
    end Finalize;

The last Gem in this series will talk about a different kind of reference,
generally known as a weak reference.

Gem #100: Reference Counting in Ada |mdash| Part 3: Weak References
-------------------------------------------------------------------

As we mentioned in the first two parts of this Gem series, GNATCOLL now
includes a package that provides support for memory management using
reference counting, including taking advantage of the efficient
synchronized add-and-fetch intrinsic function on systems where it is
available.

There is one thing that reference-counted types cannot handle as well as a
full-scale garbage collector: cycles. If ``A`` references ``B`` which
references ``A``, neither of them will ever get freed. A garbage collector
is often able to detect such cycles and deallocate all the objects as
appropriate, but such a case cannot be handled automatically through
reference counting. However, there's a variant approach that can handle
such cases with only minor changes in the code.

Let's take an example: you are retrieving values from some container (a
database for instance), and want to have a local cache to speed things up.
The code would likely be organized as follows:

    - Get a reference-counted value from the container. Its counter is 1.

    - Put it in the cache for later use. The counter is now 2, since the
      cache itself owns a reference.

    - When you are done using the value in your algorithm, you release the
      reference you had. Its counter goes down to 1 (the cache still owns
      the reference).

Because of the cache, the value is never freed from memory. This is not
good, since memory usage will only keep increasing.

GNATCOLL provides a solution for this issue, through the use of weak
references. This is a standard industry term for a special kind of
reference: you have a type that points to the same object as a true
reference-counted type would, but that type does not hold a reference.
Thus, it does not prevent the counter from reaching 0, and the object from
being freed.

When the deallocation occurs, the internal data of the weak reference is
reset. Thus, if you retrieve the data stored in the weak reference, you
get :ada:`null`, not an erroneous access to some freed memory (which might
sooner or later result in a :ada:`Storage_Error`).

If we set up the cache so that it uses weak references, the code becomes:

    - Get a reference-counted value from the container. Its counter is 1.

    - Put it in the cache, through a weak reference. The counter is still
      1.

    - When you are done using the value, the counter goes down to 0, and
      the memory is freed.

    - At this point, the cache still contains the weak reference, but the
      latter uses just a little memory.

Using slightly more complex code, it is possible, in fact, to remove the
entry for the cache altogether when the value is freed, thus really
releasing all memory to the system. Though GNATCOLL does provide a
capability for using weak references, a future package will provide easier
handling of such caches.

One way to implement weak references is by adding an extra pointer in type
:ada:`Refcount`. GNATCOLL chooses to make this optional: if you want to
systematically have that extra pointer in your data structure, you can use
weak references. Otherwise, you still have access to the code we described
in the first part of this Gem series.

We will not go into the details of the implementation for a weak
reference. Interested parties can look at the code in
:ada:`GNATCOLL.Refcount.Weakref`, which is relatively small.

Gem #107: Preventing Deallocation for Reference-counted Types
-------------------------------------------------------------

by Ada Magica |mdash| C.K.W. Grein

In Gem #97, a reference-counting pointer was presented, where a :ada:`Get`
function returns an access to the data. This could be dangerous, since the
caller might want to free the data (which should remain under control of
the reference type). In this Gem, we present a method to prevent the
misuse of the result of :ada:`Get`.

Let's repeat the relevant declarations:

.. code-block:: ada

      type Refcounted is abstract tagged private;
      type Refcounted_Access is access Refcounted'Class;

      type Ref is tagged private;  -- our smart pointer

      procedure Set (Self: in out Ref; Data: Refcounted'Class);
      function  Get (Self: Ref) return Refcounted_Access;

    private

      type Ref is new Ada.Finalization.Controlled with record
        Data: Refcounted_Access;
      end record;

The function :ada:`Get` lets us retrieve and modify the accessed object.
The problem with this function is that it compromises the safety of the
pointer type :ada:`Ref`, in that a caller might copy the result access
object and deallocate the accessed object:

.. code-block:: ada

      Copy: Refcounted_Access := Get (P);
      Free (Copy);

where :ada:`Free` is an appropriate instantiation of
:ada:`Unchecked_Deallocation`.

To cure the situation, we no longer return a direct access to the data.
Instead we define an accessor, a limited type with such an access as a
discriminant, and let :ada:`Get` return an object of such a type:

.. code-block:: ada

      type Accessor (Data: access Refcounted'Class) is limited null record;
      function Get (Self: Ref) return Accessor;

Making the type limited prevents copying, and access discriminants are
unchangeable. The discriminant also cannot be copied to a variable of type
:ada:`Refcounted_Access`. The result is that the discriminant can be used
only for reading and writing the object, but not for deallocation. Thus we
have achieved our goal of making accesses safe.

A user might now declare some type derived from :ada:`Refcounted` and
change the value of the accessed object like so:

.. code-block:: ada

      declare
        type My_Refcount is new Refcounted with record
          I: Integer;
        end record;

        P: Ref;

      begin
        Set (P, My_Refcount'(Refcounted with I => -10));
        My_Refcount (Get (P).Data.all).I := 42;
      end;

This view conversion to :ada:`My_Refcount` will incur a tag check that
will succeed in this example. In general, you have to know the type with
which to view-convert in order to access the relevant components. An
alternative is to declare a generic package like the following:

.. code-block:: ada

      generic
        type T is private;
      package Generic_Pointers is
        type Accessor (Data: access T) is limited private;
        type Smart_Pointer is private;
        procedure Set (Self: in out Smart_Pointer; Data: in T);
        function  Get (Self: Smart_Pointer) return Accessor;
      private
        ... implementation not shown
      end Generic_Pointers;

Instantiate with type :ada:`Integer` and the last line becomes instead:

.. code-block:: ada

      Get (P).Data.all := 42;

So how do we implement the function :ada:`Get`? This is quite
straightforward in Ada 2005, using a function returning a limited
aggregate. (Note that in Ada 95, limited objects were returned by
reference, whereas in Ada 2005 limited function results are built in
place.)

.. code-block:: ada

      function Get (Self: Ref) return Accessor is
      begin
         return Accessor'(Data => Self.Data);
      end Get;

Alas, we are not yet completely safe. To see this, we have to consider in
detail the lifetime of the :ada:`Accessor` objects. In the example above,
the lifetime of :ada:`Get (P)` ends with the statement and the accessor is
finalized. That is, it ceases to exist (in Ada vernacular, the master of
the object is the statement). So, tasking issues aside, nothing can happen
to the accessed object (the integer in our example) as long as the
accessor exists.

Now consider a variant of the above. Imagine we have a pointer :ada:`P`
whose reference count is 1, and let's extend the accessor's lifetime:

.. code-block:: ada

      declare
         A: Accessor renames Get (P);
      begin
         Set (P, ...);  -- allocate a new object
         My_Refcount (A.Data.all).I := 42;  -- ?
      end;  -- A's lifetime ends here

In this example, the master of the accessor is the block (and there are
other ways to make the lifetime as long as one wishes). Now in the block,
the pointer :ada:`P` is given a new object to access. Since we said that
:ada:`P` was the only pointer to the old object, it's finalized with
disastrous effect: :ada:`A.Data` is now a dangling pointer granting access
to a nonexistent object until the end of the declare block.

(Note that this issue also existed in the original
:ada:`GNATCOLL.Refcount` implementation.)

To cure the situation, we have to prevent the deallocation. That suggests
increasing the reference count with the construction of an accessor and
decreasing the count when the accessor is finalized again. The easiest way
to accomplish this is to piggyback upon the properties of the smart
pointer type:

.. code-block:: ada

      type Accessor (Data: access Refcounted'Class) is limited record
        Hold: Ref;
      end record;

      function Get (Self: Ref) return Accessor is
      begin
        return Accessor'(Data => Self.Data, Hold => Self);
      end Get;

Incidentally, as a final note, the type :ada:`Accessor` should probably be
declared as limited private, to avoid the possibility of clients
constructing aggregates (which, by the way, would be quite useless).
