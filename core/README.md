# @fobx/core

## Getting Started

The behavior of @fobx/core is almost identical to that of mobx with respect to
the critical path of behavior. Meaning it passes all of the mobx unit tests with
respect to observable values, computed values, reactions and transactions (once
API differences have been accounted for).

Because of this functional equivalence, almost all of the mobx documentation and
stack overflow questions found for mobx are applicable to @fobx/core. The
following are the notable differences that are needed in order to get started:

1. Fobx has two methods for creating observable state, `observable` and
   `observableBox` functions.

   ```js
   import { observable, observableBox } from "@fobx/core"

   const num = observableBox(1)
   const str = observableBox("hello fobx")
   const bool = observableBox(true)
   const arr = observable([1, 2, 3])
   const map = observable(
     new Map([
       ["a", "a"],
       ["b", "b"],
     ]),
   )
   const set = observable(new Set([1, 2, 3]))
   const obj = observable({ a: 1, b: 2 })
   class A {
     a = 1
     constructor() {
       this.b = 2
       // acts like mobx's makeAutoObservable
       observable(this)
     }
   }
   ```

2. `observableBox` is needed when making a primitive type observable. When this
   happens you get and set the value through the `.value` property.

   ```js
   import { observableBox } from "@fobx/core"

   const a = observableBox(1)
   console.log(a.value) // prints 1
   a.value = 5
   console.log(a.value) // prints 5
   ```

3. Observable values are tracked immediately instead of waiting until the end of
   the reaction body.

   ```js
   const o = observableBox(0);
   const seen: number[] = [];

   autorun(() => {
      seen.push(o.value);
      if (o.value < 3) o.value += 1;
   });

   console.log(seen); // prints [0,1,2,3] ... mobx will have [0]
   o.value += 1;
   console.log(seen) // prints [0,1,2,3,4] ... mobx will have [0,2,3,4]
   ```

## TODO List

1. `observableObject` needs to handle property add + delete?
1. Find and address any `TODO:` comments in the code.

## Notes

1. Array functions with callbacks (filter, forEach, every, etc...) return the
   non-proxied array as the 3rd argument of the callback instead of the proxy.
   This is for performance related reasons. Consumers have access to the proxied
   array (they're calling the function on it) if they need to do something with.
