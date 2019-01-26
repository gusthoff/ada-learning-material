:orphan:

:code-config:`run_button=False;prove_button=False;accumulate_code=False`
:code-config:`reset_accumulator=True`

Where did my memory go?
=======================

.. include:: <isopub.txt>

.. role:: ada(code)
   :language: ada

.. role:: c(code)
   :language: c

.. role:: cpp(code)
   :language: c++

Original Gems:

    - `Gem #77: Where did my memory go? (Part 1) <https://www.adacore.com/gems/gem-77>`_
    - `Gem #78: Where did my memory go? (Part 2) <https://www.adacore.com/gems/gem-78>`_
    - `Gem #79: Where did my memory go? (Part 3) <https://www.adacore.com/gems/gem-79>`_

Gem #77: Where did my memory go? (Part 1)
----------------------------------------------

Let's get started...

Unless your coding standard forbids any dynamic allocation, memory
management is a constant concern during system development. You might want
to limit the amount of memory that your application requires, or you might
have memory leaks (allocation chunks that are never returned to the
system). The latter is a critical concern for long-running applications.

Part I: Storage Pools
~~~~~~~~~~~~~~~~~~~~~

The standard Ada memory management mechanism is the storage pool, as
defined in package :ada:`System.Storage_Pools`. A storage pool is a tagged
type that allows you to override the standard :ada:`new` operator and the
associated :ada:`Unchecked_Deallocation` procedure. A given pool can be
associated with one or more access types. The GNAT run-time comes with a
number of predefined storage pools, and you can also create your own. One
basic implementation, for instance, would be to instrument the pool
operations to print a trace to the console every time memory is allocated
or freed, and then post-process those traces with an external tool
afterward.

This is of course a little tedious, so GNAT provides the package
:ada:`GNAT.Debug_Pools` as a much more advanced storage pool
implementation that can, at any time during program execution, display the
currently allocated memory (along with a backtrace of the code at the
point of allocation). It will also detect invalid memory references (for
instance, attempting to dereference a pointer to already deallocated
memory). The implementation is efficient and imposes only a very small
overhead on your application.

Here is a short example demonstrating the use of debug pools:

.. code-block:: ada

    with GNAT.Debug_Pools;

    package My_Package is
       Pool : GNAT.Debug_Pools.Debug_Pool;

       type Integer_Access is access Integer;
       for Integer_Access'Storage_Pool use Pool;
    end My_Package;

    with My_Package; use My_Package;
    with Ada.Unchecked_Deallocation;

    procedure Main is
       procedure Unchecked_Free is
          new Ada.Unchecked_Deallocation (Integer, Integer_Access);
       Ptr : Integer_Access;
    begin
       Ptr := new Integer;
       Ptr.all := 1;
       Unchecked_Free (Ptr);
       Ptr.all := 2;  --  raises exception
    end Main;

The variable :ada:`My_Package.Pool` should be shared as much as possible
among all your access types. It's not necessary to create one per access
type.

As noted in the main procedure, the last reference to :ada:`Ptr` is
invalid, and will result in an exception raised from the debug pool
(rather than some erroneous behavior depending on the system).

:ada:`GNAT.Debug_Pools` provides various subprograms to analyze current
memory usage, in particular the total amount of memory currently
allocated, as well as which part of the code did the allocations. The
backtraces are also useful when analyzing double-deallocation scenarios,
since a debug pool shows both where the memory was allocated and by what
piece of code it was first deallocated.

However, GNAT's debug pools are rather heavy to put in place in existing
code, since you need to add a :ada:`for Type_Name'Storage_Pool use Pool`
to every access type, and there is no mechanism to define a single default
storage pool for all types. :ada:`GNAT.Debug_Pools` can also give false
warnings when dereferencing a pointer to aliased data on the stack (which
was never allocated via a :ada:`new` operator, but was accessed via an
:ada:`'Access` attribute).

In the next Gem we will discuss an alternative approach to controlling and
instrumenting dynamic allocation and deallocation, by overriding the
low-level memory management support itself.

Gem #78: Where did my memory go? (Part 2)
----------------------------------------------

Let's get started...

Unless your coding standard forbids any dynamic allocation, memory
management is a constant concern during system development. You might want
to limit the amount of memory that your application requires, or you might
have memory leaks (allocation chunks that are never returned to the
system). The latter is a critical concern for long-running applications.

Part II: :ada:`System.Memory`
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

In the previous Gem we discussed the use of :ada:`GNAT.Debug_Pools` to
detect memory problems. Another approach that is somewhat easier to use,
because it doesn't require changes to the application, is to override the
:ada:`System.Memory` package. In :program:`GNAT` and its run-time, all
actual memory allocations are done via this package, which among other
things does the low-level system calls to :c:`malloc()` and :c:`free()`.

If you create your own version of :ada:`System.Memory`, you will in fact
short-circuit all memory allocation and deallocation, and replace it with
your own. To do so, copy the file ``s-memory.adb`` to one of your source
directories, modify it as appropriate, and compile your application,
passing the ``-a`` switch to :program:`gnatmake` (:program:`gprbuild`
currently does not have an equivalent switch, although using project files
should work as expected). This ensures that :program:`GNAT` will recompile
the library with your modified :ada:`System`.

Using this package does not provide the same safety as the debug pools,
since it does not check that dereferences are valid, and so your code
could still be accessing invalid memory. On the other hand, the use of
:ada:`System.Memory` is much less intrusive in your code.
:ada:`System.Memory` is best viewed as a performance analysis tool rather
than a debugging tool, although it will allow you to monitor your code for
memory leaks.

The :ada:`GNATCOLL` library (a recent addition to the GNAT technology, and
part of the latest customer and public releases) provides such an
implementation in the form of the :ada:`GNATCOLL.Memory` package. This
package is not a direct replacement for :ada:`System.Memory`, but only a
minimal amount of work is needed to make use of it, by creating a version
of ``s-memory.adb`` file that contains the following:

.. code-block:: ada

    with GNATCOLL.Memory;
    package body System.Memory is

       package M renames GNATCOLL.Memory;

       function Alloc (Size : size_t) return System.Address is
       begin
          return M.Alloc (M.size_t (Size));
       end Alloc;

       procedure Free (Ptr : System.Address) renames M.Free;

       function Realloc
          (Ptr  : System.Address;
           Size : size_t)
          return System.Address
       is
       begin
          return M.Realloc (Ptr, M.size_t (Size));
       end Realloc;

    end System.Memory;

You then need to modify your code so that it properly initializes
:ada:`GNATCOLL.Memory`, which is done via a call like the following:

.. code-block:: ada

    GNATCOLL.Memory.Configure (Activate_Monitor => True);

The monitoring provided by this :ada:`GNATCOLL` package is not enabled by
default, to limit overhead on a running program. In your application,
monitoring could be activated through a command-line switch, or by means
of a specific environment variable. (This is all fully under your control,
though, so you'll have to do the actual call to :ada:`Getenv` and then to
:ada:`Configure`.)

You can then instrument your code in one or more places to dump the memory
usage at that point. This is done through a call such as the following:

.. code-block:: ada

    GNATCOLL.Memory.Dump (Size => 3, Report => Memory_Usage);

Such a call will print on the console three backtraces for the code that
allocated the most memory (among the currently allocated memory). Variants
exist to dump the backtraces that executed the greatest number of
allocations (as opposed to the largest allocation size), or the total
amount of memory, even if that memory has since been released.

Such a dump includes a backtrace with addresses, which you can convert to
a symbolic backtrace by using the external tool :program:`addr2line` as
follows:

.. code-block:: none

    addr2line -e

This library has very light overhead (in particular when not activated) so
that you can distribute your application with support for
:ada:`GNATCOLL.Memory` built in, and then investigate any issues that
arise in production code. In fact, our own :program:`GPS` IDE now includes
this support. Activation is controlled by an external variable, and
dumping the state of memory can be done through a Python command at any
point in time without the need to recompile :program:`GPS`. (Note that
:ada:`GNATCOLL` also provides an interface to Python.)

Another feature of :ada:`GNATCOLL.Memory` is the capability of resetting
all counters to zero. For example, let's assume we want to investigate
memory leaks while opening and closing editors in GPS. If we look at the
places that allocate memory, the biggest allocations that are displayed in
the console do not concern the editor itself, but rather memory allocated
when :program:`GPS` started (if you are curious, this is generally memory
that is related to the cross-reference database). Therefore, we would do the
following: start :program:`GPS`, reset :ada:`GNATCOLL.Memory` counters to
0, open and close an editor, and dump memory usage. At that point, if
:ada:`Dump` prints any information on the console, we know that this is
memory that has been allocated since the call to :ada:`Reset`, and that
wasn't freed when the editor was closed, and therefore is most likely a
memory leak.

The appropriate use of :ada:`Reset` and :ada:`Dump` therefore allows the
monitoring of memory usage in specific parts of the code.

A separate tool called :program:`gnatmem` is also distributed with GNAT.
When you link your application with the ``-lgmem`` switch, it will
transparently instrument all calls to the standard :c:`malloc` and
:c:`free` (from the Ada code), in a fashion similar to
:ada:`GNATCOLL.Memory`. On program exit, a disk file is created that you
can then analyze using :program:`gnatmem`, to highlight the sources of
memory leaks in your application. This tool requires no change to your
code at all, but, on the other hand, does not provide a way to monitor
specific sections of your code like :ada:`GNATCOLL.Memory` does.

:program:`gnatmem` provides a number of command-line switches to control
the display of information. For instance, the switch ``-m 0`` lets you
view all places in your code that ever allocated memory, even if that
memory was properly deallocated afterwards. When one such place is doing
millions of allocations, it might sometimes be more efficient to use a
custom :ada:`Storage_Pool` and avoid the system call to :c:`malloc`, by
reusing memory. The ``-s`` switch allows you to sort the output in various
ways.

In Part III of this series, we will take a look at various commercially
available system tools for monitoring and analyzing memory usage.

Gem #79: Where did my memory go? (Part 3)
----------------------------------------------

Let's get started...

Part III: External Tools
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The previous two Gems on memory monitoring explained the use of
:ada:`GNAT.Debug_Pools` and :ada:`GNATCOLL.Memory` to monitor memory
access and detect memory leaks.

Some very powerful external tools exist on some systems that can be used
to achieve similar goals. Very often, these tools will simply replace the
system calls :c:`malloc` and :c:`free`, although in some cases they will
in fact emulate a virtual machine in which your application is run.

One common kind of tool, available on most systems, indicates how much
memory your application is using (such as the :program:`Process Manager`
on Windows or :program:`top` on Unix systems). This is however a very
limited tool, since memory that is properly freed by your application
might in fact not be given back to the system (for performance reasons,
:c:`malloc` keeps it and reuses it for the next allocation). So it is very
hard to discover memory leaks that way, and of course even if you can see
that there is a leak, you have no way of knowing where it is in your code.

One very useful Linux application is :program:`valgrind`. This is a
virtual machine, that you start with various tools. One of them is a
memory checker, which can detect invalid memory accesses, double
deallocation, use of uninitialized variables, and memory leaks. You do not
need to do anything special when compiling your application and you can
simply run it as follows:

.. code-block:: none

    valgrind --tool=memcheck your_app app_arguments

If you also want to detect memory leaks, start your application with:

.. code-block:: none

    valgrind --tool=memcheck --leak-check=full --leak-resolution=med your_app

Compared to the techniques we discussed in the previous Gems,
:program:`valgrind` is much slower (since all code runs in a virtual
machine), but more accurate. For instance, when it reports memory leaks,
it will only report those chunks of memory that are no longer referenced
anywhere in your application. For instance, if you have a global constant
initialized once by calling :ada:`new ...`, the Ada packages would report
it as a leak, whereas :program:`valgrind` by default knows it is still
referenced and will not bother you with it (although, of course, you have
an option to see it, namely ``--show-reachable``). Since it is often very
hard to free such memory (you have to do it at finalization time), and
generally not worth it since the memory will be reclaimed by the system
anyway, you generally want to ignore those chunks.

Likewise, if you have an allocated object that itself contains accesses to
dynamically allocated memory, :program:`valgrind` will by default only
report the root object as a leak, since the other chunks are accessible
from the first. When you fix the leak for the first, it is likely that you
will at the same time fix the other leaks as well.

Other sources of memory leaks, much harder to detect, are those that occur
in the graphical part of your application. On most systems, graphical
rendering is a client-server process, and the memory is allocated on the
server, not on the client. Therefore, tools like :program:`valgrind` or
the GNAT packages would not be able to report it as a leak (for instance
if you have allocated a big pixmap but never freed it). On Windows these
are called *GID*, and are visible in the :program:`Process Manager`, so
that you can actually monitor whether your application seems to have such
leaks. Once again, though, this provides no detail as to the origin of the
leak.

On Unix, you can use the :program:`xrestop` application, which can tell
you the number of windows, cursors, graphic context, etc. that you have
allocated.

Many such tools like this exist, both commercial and free. Let us know if
you routinely use such tools, as they could be useful to other readers of
this Gem.
