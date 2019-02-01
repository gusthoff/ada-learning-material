:orphan:

:code-config:`run_button=False;prove_button=False;accumulate_code=False`
:code-config:`reset_accumulator=True`

The Mod Attribute
=================

.. include:: <isopub.txt>

.. role:: ada(code)
   :language: ada

.. role:: c(code)
   :language: c

.. role:: cpp(code)
   :language: c++

Original Gems:

    - `Gem #26: The Mod Attribute by Bob Duff <https://www.adacore.com/gems/gem-26>`_

Gem #26: The Mod Attribute
--------------------------

by Bob Duff |mdash| AdaCore

Let's get started...

Ada has two kinds of integer type: signed and modular:

.. code-block:: ada

    type Signed_Integer is range 1..1_000_000;
    type Modular is mod 2**32;

Operations on signed integers can overflow: if the result is outside the
base range, :ada:`Constraint_Error` will be raised. The base range of
:ada:`Signed_Integer` is the range of :ada:`Signed_Integer'Base`, which is
chosen by the compiler, but is likely to be something like
:ada:`-2 ** 31.. 2 ** 31 - 1`.

Operations on modular integers use modular (wraparound) arithmetic.

For example:

.. code-block:: ada

      X : Modular := 1;
      X := - X;

Negating :ada:`X` gives :ada:`-1`, which wraps around to
:ada:`2 ** 32 - 1`, i.e. all-one-bits.

But what about a type conversion from signed to modular? Is that a signed
operation (so it should overflow) or is it a modular operation (so it
should wrap around)? The answer in Ada is the former |mdash| that is, if
you try to convert, say, :ada:`Integer'(-1)` to :ada:`Modular`, you will
get :ada:`Constraint_Error`:

.. code-block:: ada

      I : Integer := -1;
      X := Modular (I);  --  raises Constraint_Error

In Ada 95, the only way to do that conversion is to use
:ada:`Unchecked_Conversion`, which is somewhat uncomfortable. Furthermore,
if you're trying to convert to a generic formal modular type, how do you
know what size of signed integer type to use? Note that
:ada:`Unchecked_Conversion` might malfunction if the source and target
types are of different sizes.

A small feature added to Ada 2005 solves the problem: the :ada:`Mod`
attribute:

.. code-block:: ada

    generic
       type Formal_Modular is mod <>;
    package Mod_Attribute is
       function F return Formal_Modular;
    end Mod_Attribute;

    package body Mod_Attribute is

       A_Signed_Integer : Integer := -1;

       function F return Formal_Modular is
       begin
          return Formal_Modular'Mod (A_Signed_Integer);
       end F;

    end Mod_Attribute;

The :ada:`Mod` attribute will correctly convert from any integer type to a
given modular type, using wraparound semantics. Thus, :ada:`F` will return
the all-ones bit pattern, for whatever modular type is passed to
:ada:`Formal_Modular`.

.. code-block:: ada

    generic
       type Formal_Modular is mod <>;
    package Mod_Attribute is

       function F return Formal_Modular;

    end Mod_Attribute;

.. code-block:: ada

    package body Mod_Attribute is

       A_Signed_Integer : Integer := -1;

       function F return Formal_Modular is
       begin
          return Formal_Modular'Mod (A_Signed_Integer);
       end F;

    end Mod_Attribute;

.. code-block:: none

    with Ada.Text_IO; use Ada.Text_IO;
    with Mod_Attribute;

    procedure Main is

       type Signed_Integer is range 1 .. 1_000_000;
       type Modular is mod 2 ** 32;

    begin
       declare
          X : Modular := 1;
       begin
          X := - X;
          pragma Assert (X = 2 ** 32 - 1);
          pragma Assert (X = 16#FFFF_FFFF#);
          Put_Line ("X =" & X'Img);  --  prints "X = 4294967295"
       end;

       declare
          I : Integer := -1;
          X : Modular;
       begin
          X := Modular (I);  --  raises Constraint_Error
          --  GNAT warns here:
          --  warning: value not in range of type "Modular" defined at line 7
          --  warning: "Constraint_Error" will be raised at run time

          Put_Line ("X =" & X'Img);  --  doesn't print anything
       exception
          when Constraint_Error =>
             Put_Line ("Constraint_Error raised.");
       end;

       declare
          type My_Modular is mod 2 ** 16;
          package M is new Mod_Attribute (Formal_Modular => My_Modular);
       begin
          pragma Assert (M.F = 2#1111_1111_1111_1111#);
          Put_Line ("M.F =" & M.F'Img);  --  prints "M.F = 65535".
       end;
    end Main;
