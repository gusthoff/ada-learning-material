:orphan:

:code-config:`run_button=False;prove_button=False;accumulate_code=False`
:code-config:`reset_accumulator=True`

Speedy Shift and Rotate in SPARK
================================

.. include:: <isopub.txt>

.. role:: ada(code)
   :language: ada

.. role:: c(code)
   :language: c

.. role:: cpp(code)
   :language: c++

Original Gems:

    - `Gem #80: Speedy Shift and Rotate in SPARK by Rod Chapman <https://www.adacore.com/gems/gem-80>`_

Gem #80: Speedy Shift and Rotate in SPARK
-----------------------------------------

by Rod Chapman |mdash| Altran

Let's get started...

Introduction

Ada 95 brought us the predefined package :ada:`Interfaces`, with its
standard definitions for types like :ada:`Unsigned_32` and so on. It also
defines various functions to do common shift and rotate operations on
those types, such as:

.. code-block:: ada

       function Shift_Left
         (Value  : Unsigned_32;
          Amount : Natural) return Unsigned_32;

In GNAT Pro, these function declarations are also followed by a
curious-looking :ada:`pragma`:

.. code-block:: ada

       pragma Import (Intrinsic, Shift_Left);

The Ada 95 RM (6.3.1) says:

    The intrinsic calling convention represents subprograms that are
    *built-in* to the compiler.

This basically means that the code generator *knows* how to implement
these functions. In the case of shifts and rotates, this means that a call
to one of these functions results in very few (possibly just one) machine
instructions |mdash| giving the performance you'd expect from such a
simple operation.

Shifts and rotates are useful in a wide variety of applications, but are
endemic in cryptographic algorithms, where they appear all over the place.

So how can we get at them in SPARK?

Unfortunately, the standard specification of package :ada:`Interfaces` is
not legal SPARK, since the various shift and rotate functions are
overloaded for each of the modular types, and overloading within a scope
is not allowed. Darn...

To get round this, we first introduce a *shadow* specification of
:ada:`Interfaces` that supplies the legal SPARK bits that we're interested
in |mdash| specifically the type declarations, thus:

.. code-block:: ada

       package Interfaces is
          type Unsigned_8  is mod 2**8;
          type Unsigned_16 is mod 2**16;
          type Unsigned_32 is mod 2**32;
          type Unsigned_64 is mod 2**64;
       end Interfaces;

This is legal SPARK, and goes in a file called ``interfaces.shs``. We then
use the Examiner's index-file mechanism to make sure that the Examiner
sees this version of the package specification.

To get at the shift and rotate functions, we need to introduce a new
package that *de-overloads* the names. Let's call this package :ada:`SR`
|mdash| this is also a *shadow*, so it goes in ``sr.shs`` or a similar
file. It looks like this:

.. code-block:: ada

       with Interfaces;
       --# inherit Interfaces;
       package SR is

          function Rotate_Left_16
            (Value  : Interfaces.Unsigned_16;
             Amount : Natural) return Interfaces.Unsigned_16;

          function Rotate_Left_32
            (Value  : Interfaces.Unsigned_32;
             Amount : Natural) return Interfaces.Unsigned_32;

          -- ...and so on for all required functions...
       end SR;

Note how we removed the overloading of the function names.

OK... so how do we glue package :ada:`SR` to the predefined intrinsic
functions in package :ada:`Interfaces`?

It's tempting to just implement the body of :ada:`SR` (in Ada, not SPARK)
to *call through* to the appropriate function in :ada:`Interfaces`, but
this might involve the overhead of a full-blown function call/return
sequence, losing all that juicy performance that the intrinsic functions
give us. We could try using :ada:`pragma Inline` to get rid of that
overhead, but, as car salesmen say, "your mileage may vary" with that
idea.

Fortunately, there is a way out that preserves the efficiency of the
intrinsic version. Remember that the specification of :ada:`SR` above is a
shadow? We supply the following slightly different version to the compiler
in ``sr.ads``:

.. code-block:: ada

       with Interfaces;
       package SR is

          function Rotate_Left_16
            (Value  : Interfaces.Unsigned_16;
             Amount : Natural) return Interfaces.Unsigned_16 renames
               Interfaces.Rotate_Left;

          function Rotate_Left_32
            (Value  : Interfaces.Unsigned_32;
             Amount : Natural) return Interfaces.Unsigned_32 renames
               Interfaces.Rotate_Left;

          -- ...and so on
       end SR;

The renaming here ensures that our SPARK-friendly *un-overloaded*
functions are synonymous with the intrinsic *built-in* functions, getting
us the best of both worlds |mdash| the type safety of SPARK, with the
efficiency of intrinsic machine code!
