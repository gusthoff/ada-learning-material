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

    - `Gem #132 : Erroneous Execution - Part 1 by Bob Duff <https://www.adacore.com/gems/gem-132-erroneous-execution-part-1>`_
    - `Gem #133 : Erroneous Execution - Part 2 by Bob Duff <https://www.adacore.com/gems/gem-133-erroneous-execution-part-2>`_
    - `Gem #134 : Erroneous Execution - Part 3 by Bob Duff <https://www.adacore.com/gems/gem-134-erroneous-execution-part-3>`_
    - `Gem #135 : Erroneous Execution - Part 4 by Bob Duff <https://www.adacore.com/gems/gem-134-erroneous-execution-part-4>`_

Gem #132: Erroneous Execution |mdash| Part 1
--------------------------------------------

by Bob Duff |mdash| AdaCore

Let's get started...

Ada is pretty good about requiring compilers to detect errors at compile
time, or failing that, at run time. However, there are some kinds of
errors that are infeasible to detect. The Reference Manual calls such
errors "erroneous execution".

RM-1.1.5(10) defines the term:

    ...[T]he implementation need not detect such errors either prior to or
    during run time. ...[T]here is no language-specified bound on the
    possible effect of erroneous execution; the effect is in general not
    predictable.

An example of erroneous execution is suppressing a check that fails. For
example:

.. code-block:: ada

    pragma Suppress (All_Checks);  --  Or use the -gnatp switch
    --  ...
    A (X) := A (X) + 1;

If :ada:`X` is out of bounds, then the above results in erroneous
execution. That means that the program can do anything at all. In
explaining the meaning of erroneousness, people often like to talk of
spectacular disasters: "It might erase your system disk!" "Your keyboard
might catch on fire!" "Nasal demons!"

I think that's somewhat misleading. For one thing, if you're running under
an operating system, with proper protections set up, erroneous execution
will not erase your system disk. The point is that Ada doesn't ensure
that, but the operating system does. Likewise, Ada doesn't prevent your
keyboard from catching on fire, but we hope the computer manufacturer
will.

One disaster that actually might happen is that the above code will
overwrite some arbitrary memory location. Whatever variable was stored
there might be destroyed. That's a disaster because it can take hours or
even days to track down such bugs. If you're lucky, you'll get a
segmentation fault right away, making the bug much easier to figure out.

But the worst thing of all is not keyboard fires, nor destroyed variables,
nor anything else spectacular. The worst thing an erroneous execution can
cause is for the program to behave exactly the way you wanted it to,
perhaps because the destroyed memory location wasn't being used for
anything important. So what's the problem? If the program works, why
should we care if some pedantic language lawyer says it's being erroneous?

To answer that question, note this common debugging technique: You have a
large program. You make a small change (to fix a bug, to add a new
feature, or just to make the code cleaner). You run your regression tests,
and something fails. You deduce that the cause of the new bug is the small
change you made. Because the change is small relative to the size of the
whole program, it's easy to figure out what the problem is.

With erroneousness, that debugging technique doesn't work. Somebody wrote
the above erroneous program (erroneous if :ada:`X` is out of bounds, that
is). It worked just fine. Then a year later, you make some change totally
unrelated to the :ada:`A (X) := A (X) + 1;` statement. This causes things
to move around in memory, such that now important data is destroyed. You
can no longer assume that your change caused the bug; you have to consider
the entire program text.

The moral of the story is: Do not write erroneous programs.

Gem #133: Erroneous Execution |mdash| Part 2
--------------------------------------------

by Bob Duff |mdash| AdaCore

Let's get started...

The moral of the story was: Do not write erroneous programs.

Strictly speaking, that's wrong usage. "Erroneous" refers to a particular
execution of a program, not to the program itself. It's possible to write
a program that has erroneous behavior for some input data, but not for
some other input data. Nonetheless, it's reasonable to use "erroneous
program" to refer to a program that might have erroneous behavior. Just
remember that "erroneous" is not a property of the program text, but a
property of the program text plus its input, and even its timing.

Never deliberately write code that can cause erroneous execution. For
example, I've seen people suppress :ada:`Overflow_Checks`, because they
"know" the hardware does wrap-around (modular) arithmetic, and that's what
they want. That's wrong reasoning. The RM doesn't say that overflow, when
suppressed, will do what the hardware does. The RM says anything at all
can happen.

If you suppress :ada:`Overflow_Checks`, you are telling the compiler to
assume to assume that overflow will not happen. If overflow can happen,
you are telling the compiler to assume a falsehood. In any mathematical
system, if you assume "false", anything at all can be proven true, causing
the whole house of cards to tumble. Optimizers can and do prove all sorts
of amazing things when told to assume "false".

Never try to guess that the optimizer isn't smart enough to cause trouble.
Optimizers are so complicated that even their authors can't accurately
predict what they will do. For example:

.. code-block:: ada

    X : Natural := ...;
    Y : Integer := X + 1;

    if Y > 0 then
       Put_Line (Y'Img);
    end if;

The above will print some positive number, unless :ada:`X` is
:ada:`Integer'Last`, in which case :ada:`Constraint_Error` will be raised.
The optimizer is therefore allowed to deduce that when we get to the
:ada:`if`, :ada:`Y` must be positive, so it can remove the :ada:`if`,
transforming it to:

.. code-block:: ada

    X : Natural := ...;
    Y : Integer := X + 1;

    Put_Line (Y'Img);

That's good: removing the :ada:`if` probably makes it run faster, which is
the optimizer's goal. But if checks are suppressed, the optimizer can
still do the above transformation. The reasoning is now: "when we get to
the :ada:`if`, either :ada:`Y` must be positive, or we must be erroneous".
If the former, the :ada:`if` can be removed because it's :ada:`True`. If
the latter, anything can happen (it's erroneous!), so the :ada:`if` can be
removed in that case, too. :ada:`X + 1` might produce :ada:`-2**31` (or it
might not).

We end up with a program that says:

.. code-block:: ada

    if Y > 0 then
        Put_Line (Y'Img);
    end if;

and prints a negative number, which is a surprise.

Another possible behavior of the above code (with checks suppressed) is to
raise :ada:`Constraint_Error`. "Hey, I asked for the checks to be
suppressed. Why didn't the compiler suppress them?" Well, if the execution
is erroneous, anything can happen, and raising an exception is one
possible "anything". The purpose of suppressing checks is to make the
program faster. Do not use :ada:`pragma Suppress` to suppress checks (in
the sense of relying on not getting the exception). Compilers do not
remove suppressed checks if they are free |mdash| for example, imagine a
machine that automatically traps on overflow.

Perhaps :ada:`pragma Suppress` should have been called something like
:ada:`Assume_Checks_Will_Not_Fail`, since it doesn't (necessarily)
suppress the checks.

Gem #134: Erroneous Execution |mdash| Part 3
--------------------------------------------

by Bob Duff |mdash| AdaCore

Let's get started...

We showed how this:

.. code-block:: ada

    X : Natural := ...;
    Y : Integer := X + 1;
    if Y > 0 then <
         Put_Line (Y'Img);
    end if;

can end up printing a negative number if checks are suppressed.

In fact, a good compiler will warn that :ada:`Y > 0` is necessarily
:ada:`True`, so the code is silly, and you can fix it. But you can't count
on that. Optimizers are capable of much more subtle reasoning, which might
not produce a warning. For example, suppose we have a procedure:

.. code-block:: ada

    procedure Print_If_Positive (Y : Integer) is
    begin
       if Y > 0 then
          Put_Line (Y'Img);
       end if;
    end Print_If_Positive;

It seems *obvious* that :ada:`Print_If_Positive` will never print a
negative number. But in the presence of erroneousness, that reasoning
doesn't work:

.. code-block:: ada

    X : Natural := ...;
    Y : Integer := X + 1;
    Print_If_Positive (Y);

The optimizer might decide to inline the call, and then optimize as in the
previous example.

Other language features that can cause erroneous execution include:

    - Shared variables (erroneous if multiple tasks fail to synchronize)
    - :ada:`Address` clauses
    - :ada:`Unchecked_Conversion`
    - Interface to other languages
    - Machine-code insertions
    - User-defined storage pools
    - :ada:`Unchecked_Deallocation`

A complete list can be found by looking up "erroneous" in the RM index, or
by searching the RM. Every case of erroneous execution is documented under
the heading "Erroneous Execution".

You should try to minimize the use of such features. When you need to use
them, try to encapsulate them so you can reason about them locally. And be
careful.

As for suppressing checks: Don't suppress unless you need the added
efficiency and you have confidence that the checks won't fail. If you do
suppress checks, run regression tests on a regular basis in both modes
(suppressed and not suppressed).

The final part of this Gem series will explain the rationale behind the
concept  of erroneous execution in Ada.

Gem #135: Erroneous Execution |mdash| Part 4
--------------------------------------------

by Bob Duff |mdash| AdaCore

Let's get started...

Many programmers believe that "optimizers should not change the behavior
of the program". Many also believe that "optimizers do not change the
behavior of the program". Both beliefs are false in the presence of
erroneousness.

So if erroneousness is so bad, why does the Ada language design have it?
Certainly, a language designer should try to minimize the amount of
erroneousness. Java is an example of a language that eschews
erroneousness, but that comes at a cost. It means that lots of useful
things are impossible or infeasible in Java: device drivers, for example.
There is also an efficiency cost. C is an example of a language that has
way too much erroneousness. Every single array-indexing operation is
potentially erroneous in C. (C calls it "undefined behavior".)

Ada is somewhere in between Java and C in this regard. You can write
device drivers in Ada, and user-defined storage pools, and other things
that require low-level access to the machine.

But for the most part, things that can cause erroneousness can be isolated
in packages |mdash| you don't have to scatter them all over the program as
in C.

For example, to prevent dangling pointers, try to keep the :ada:`new` and
:ada:`Unchecked_Deallocations` together, so they can be reasoned about
locally. A generic :ada:`Doubly_Linked_List` package might have dangling
pointer bugs within itself, but it can be designed so that clients cannot
cause dangling pointers.

Another way to prevent dangling pointers is to use user-defined storage
pools that allow deallocation of the entire pool at once. Store heap
objects with similar lifetimes in the same pool. It might seem that
deallocating a whole bunch of objects is more likely to cause dangling
pointers, but in fact just the opposite is true. For one thing,
deallocating the whole pool is much simpler than walking complicated data
structures deallocating individual records one by one. For another thing,
deallocating *en masse* is likely to cause catastrophic failures that can
be fixed sooner rather than later. Finally, a user-defined storage pool
can be written to detect dangling pointers, for example by using operating
system services to mark deallocated regions as inaccessible.

Note that Ada 2012 has *subpools*, which make user-defined storage pools
more flexible.

A final point about erroneousness that might be surprising is that it can
go backwards in time. For example:

.. code-block:: ada

    if Count = 0 then
       Put_Line ("Zero");
    end if;
    Something := 1 / Count; -- could divide by zero

If checks are suppressed, the entire :ada:`if` statement, including the
:ada:`Put_Line`, can be removed by the optimizer. The reasoning is: If
:ada:`Count` is nonzero, we don't want to print *Zero*. If :ada:`Count` is
zero, then it's erroneous, so anything can happen, including not printing
*Zero*.

Even if the :ada:`Put_Line` is not removed by the compiler, it can appear
to be, because the :ada:`"Zero""` might be stored in a buffer that never
gets flushed because some later erroneousness caused the program to crash.

Every statement about Ada must be understood to have ", unless execution
is erroneous" after it. In this case, ":ada:`Count = 0` returns
:ada:`True` if :ada:`Count` is zero" is obviously true, but it really
means ":ada:`Count` = 0 returns :ada:`True` if :ada:`Count` is zero,
unless execution is erroneous, in which case anything can happen".

Moral: Take care to avoid writing erroneous programs.
