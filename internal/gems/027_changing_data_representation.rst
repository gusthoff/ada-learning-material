:orphan:

:code-config:`run_button=False;prove_button=False;accumulate_code=False`
:code-config:`reset_accumulator=True`

Changing Data Representation
============================

.. include:: <isopub.txt>

.. role:: ada(code)
   :language: ada

.. role:: c(code)
   :language: c

.. role:: cpp(code)
   :language: c++

Original Gems:

    - `Gem #27: Changing Data Representation (Part 1) by Robert Dewar <https://www.adacore.com/gems/gem-27>`_
    - `Gem #28: Changing Data Representation (Part 2) by Robert Dewar <https://www.adacore.com/gems/gem-28>`_

Gem #27: Changing Data Representation (Part 1)
----------------------------------------------

by Robert Dewar |mdash| AdaCore

Let's get started...

A powerful feature of Ada is the ability to specify the exact data layout.
This is particularly important when you have an external device or program
that requires a very specific format. Some examples are:

.. code-block:: ada

    type Com_Packet is record
       Key : Boolean;
       Id  : Character;
       Val : Integer range 100 .. 227;
    end record;

    for Com_Packet use record
       Key at 0 range 0 .. 0;
       Id  at 0 range 1 .. 8;
       Val at 0 range 9 .. 15;
    end record;

which lays out the fields of a record, and in the case of :ada:`Val`,
forces a biased representation in which all zero bits represents 100.
Another example is:

.. code-block:: ada

    type Val is (A, B, C, D, E, F, G, H);
    type Arr is array (1 .. 16) of Val;
    for Arr'Component_Size use 3;

which forces the components to take only 3 bits, crossing byte boundaries
as needed. A final example is:

.. code-block:: ada

    type Status is (Off, On, Unknown);
    for Status use (Off => 2#001#, On => 2#010#, Unknown => 2#100#);

which allows specified values for an enumeration type, instead of the
efficient default values of 0, 1, 2.

In all these cases, we might use these representation clauses to match
external specifications, which can be very useful. The disadvantage of
such layouts is that they are inefficient, and accessing individual
components, or in the case of the enumeration type, looping through the
values, can increase space and time requirements for the program code.

One approach that is often effective is to read or write the data in
question in this specified form, but internally in the program represent
the data in the normal default layout, allowing efficient access, and do
all internal computations with this more efficient form.

To follow this approach, you will need to convert between the efficient
format and the specified format. Ada provides a very convenient method for
doing this, as described in RM 13.6 "Change of Representation".

The idea is to use type derivation, where one type has the specified
format and the other has the normal default format. For instance for the
array case above, we would write:

.. code-block:: ada

    type Val is (A, B, C, D, E, F, G, H);
    type Arr is array (1 .. 16) of Val;

    type External_Arr is new Arr;
    for External_Arr'Component_Size use 3;

Now we read and write the data using the :ada:`External_Arr` type. When we
want to convert to the efficient form, :ada:`Arr`, we simply use a type
conversion.

.. code-block:: ada

    Input_Data  : External_Arr;
    Work_Data   : Arr;
    Output_Data : External_Arr;

    --  (read data into Input_Data)

    --  Now convert to internal form
    Work_Data := Arr (Input_Data);

    --  (computations using efficient Work_Data form)

    --  Convert back to external form
    Output_Data := External_Arr (Work_Data);

Using this approach, the quite complex task of copying all the data of the
array from one form to another, with all the necessary masking and shift
operations, is completely automatic.

Similar code can be used in the record and enumeration type cases. It is
even possible to specify two different representations for the two types,
and convert from one form to the other, as in:

.. code-block:: ada

    type Status_In is (Off, On, Unknown);
    type Status_Out is new Status_In;

    for Status_In use (Off => 2#001#, On => 2#010#, Unknown => 2#100#);
    for Status_Out use (Off => 103, On => 1045, Unknown => 7700);

There are two restrictions that must be kept in mind when using this
feature. First, you have to use a derived type. You can't put
representation clauses on subtypes, which means that the conversion must
always be explicit. Second, there is a rule RM 13.1(10) that restricts the
placement of interesting representation clauses:

    10 For an untagged derived type, no type-related representation items
    are allowed if the parent type is a by-reference type, or has any
    user-defined primitive subprograms.

All the representation clauses that are interesting from the point of view
of change of representation are *type related*, so for example, the
following sequence would be illegal:

.. code-block:: ada

    type Val is (A, B, C, D, E, F, G, H);
    type Arr is array (1 .. 16) of Val;

    procedure Rearrange (Arg : in out Arr);

    type External_Arr is new Arr;
    for External_Arr'Component_Size use 3;

Why these restrictions? Well the answer is a little complex, and has to do
with efficiency considerations, which we will address in next week's GEM.

Gem #28: Changing Data Representation (Part 2)
----------------------------------------------

by Robert Dewar |mdash| AdaCore

Last week, we discussed the use of derived types and representation
clauses to achieve automatic change of representation. More accurately,
this feature is not completely automatic, since it requires you to write
an explicit conversion. In fact there is a principle behind the design
here which says that a change of representation should never occur
implicitly behind the back of the programmer without such an explicit
request by means of a type conversion.

The reason for that is that the change of representation operation can be
very expensive, since in general it can require component by component
copying, changing the representation on each component.

Let's have a look at the ``-gnatG`` expanded code to see what is hidden
under the covers here. For example, the conversion :ada:`Arr`
(:ada:`Input_Data`) from last week's example generates the following
expanded code:

.. code-block:: none

    B26b : declare
       [subtype p__TarrD1 is integer range 1 .. 16]
       R25b : p__TarrD1 := 1;
    begin
       for L24b in 1 .. 16 loop
          [subtype p__arr___XP3 is
            system__unsigned_types__long_long_unsigned range 0 ..
              16#FFFF_FFFF_FFFF#]
          work_data := p__arr___XP3! ((work_data and not shift_left! (
                                      16#7#, 3 * (integer (L24b - 1)))) or shift_left! (p__arr___XP3!
                                        (input_data (R25b)), 3 * (integer (L24b - 1))));
          R25b := p__TarrD1'succ (R25b);
       end loop;
    end B26b;

That's pretty horrible! In fact, one of the Ada experts here thought that
it was too gruesome and suggested simplifying it for this gem, but we have
left it in its original form, so that you can see why it is nice to let
the compiler generate all this stuff so you don't have to worry about it
yourself.

Given that the conversion can be pretty inefficient, you don't want to
convert backwards and forwards more than you have to, and the whole
approach is only worth while if will be doing extensive computations
involving the value.

The expense of the conversion explains two aspects of this feature that
are not obvious. First, why do we require derived types instead of just
allowing subtypes to have different representations, avoiding the need for
an explicit conversion?

The answer is precisely that the conversions are expensive, and you don't
want them happening behind your back. So if you write the explicit
conversion, you get all the gobbledygook listed above, but you can be sure
that this never happens unless you explicitly ask for it.

This also explains the restriction we mentioned in last week's gem from RM
13.1(10):

    10 For an untagged derived type, no type-related representation items
    are allowed if the parent type is a by-reference type, or has any
    user-defined primitive subprograms.

It turns out this restriction is all about avoiding implicit changes of
representation. Let's have a look at how type derivation works when there
are primitive subprograms defined at the point of derivation. Consider
this example:

.. code-block:: ada

    type My_Int_1 is range 1 .. 10;

    function Odd (Arg : My_Int_1) return Boolean;

    type My_Int_2 is new My_Int_1;

Now when we do the type derivation, we inherit the function :ada:`Odd` for
:ada:`My_Int_2`. But where does this function come from? We haven't
written it explicitly, so the compiler somehow materializes this new
implicit function. How does it do that?

We might think that a complete new function is created including a body in
which :ada:`My_Int_2` replaces :ada:`My_Int_1`, but that would be
impractical and expensive. The actual mechanism avoids the need to do this
by use of implicit type conversions. Suppose after the above declarations,
we write:

.. code-block:: ada

    Var : My_Int_2;
    --  ...
    if Odd (Var) then
       --  ...

The compiler translates this as:

.. code-block:: ada

    Var : My_Int_2;
    --  ...
    if Odd (My_Int_1 (Var)) then
       --  ...

This implicit conversion is a nice trick, it means that we can get the
effect of inheriting a new operation without actually having to create it.
Furthermore, in a case like this, the type conversion generates no code,
since :ada:`My_Int_1` and :ada:`My_Int_2` have the same representation.

But the whole point is that they might not have the same representation if
one of them had a rep clause that made the representations different, and
in this case the implicit conversion inserted by the compiler could be
expensive, perhaps generating the junk we quoted above for the :ada:`Arr`
case. Since we never want that to happen implicitly, there is a rule to
prevent it.

The business of forbidding by-reference types (which includes all tagged
types) is also driven by this consideration. If the representations are
the same, it is fine to pass by reference, even in the presence of the
conversion, but if there was a change of representation, it would force a
copy, which would violate the by-reference requirement.

So to summarize these two gems, on the one hand Ada gives you a very
convenient way to trigger these complex conversions between different
representations. On the other hand, Ada guarantees that you never get
these potentially expensive conversions happening unless you explicitly
ask for them.
