import{a}from"./chunks/chunk-W22DQHDY.js";import{f as e,g as t}from"./chunks/chunk-COHAUUG5.js";e(t(a,{siteInfo:{title:"FobX Documentation",description:"Documentation for FobX state management library",version:"1.0.0",baseUrl:"/fobx"},route:{slug:"core-docs-creating-observable-state",path:"/core-docs-creating-observable-state",title:"Creating Observable State in FobX",sourcePath:"/fobx/core/docs/creating-observable-state.mdoc",parentSlug:"core",lastModified:"2025-06-04T05:56:50.042Z",readingTime:{minutes:4,words:767},frontmatter:{description:"# Creating Observable State in FobX",showEditButton:!0,title:"Creating Observable State in FobX"},content:{ast:{$$mdtype:"Tag",name:"article",attributes:{},children:[{name:"Heading",attributes:{level:1,id:"creating-observable-state-in-fobx"},children:["Creating Observable State in FobX"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["This document explains the two main approaches to creating observable state in"," ","FobX:"]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!0},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"code",attributes:{},children:["observable()"]}," - Auto-observability with optional overrides"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"code",attributes:{},children:["makeObservable()"]}," - Explicit declaration of observable properties"]}]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["Both methods allow you to create reactive state, but they differ in how"," ","properties are annotated as observable."]},{name:"Heading",attributes:{level:2,id:"observable-function-automatic-observability"},children:["Observable Function: Automatic Observability"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["The ",{$$mdtype:"Tag",name:"code",attributes:{},children:["observable()"]}," function automatically makes all properties observable by"," ",'default. It follows a "make everything observable unless specified otherwise"'," ","approach."]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { observable } from "@fobx/core"

// All properties automatically become observable (deep observability)
const user = observable({
  name: "Alice",
  age: 30,
  profile: {
    avatar: "alice.jpg",
    settings: {
      theme: "dark",
    },
  },
  hobbies: ["reading", "hiking"],
})

// Changes to any property (including nested ones) will trigger reactions
user.name = "Bob" // Triggers reactions
user.profile.settings.theme = "light" // Triggers reactions
user.hobbies.push("swimming") // Triggers reactions
`]},{name:"Heading",attributes:{level:3,id:"overriding-default-behavior"},children:["Overriding Default Behavior"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["You can override the automatically applied observability for specific properties"," ","by providing annotations:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { observable } from "@fobx/core"

const store = observable({
  user: { name: "Alice", age: 30 },
  settings: { theme: "dark" },
  metaData: { lastUpdated: new Date() },
}, {
  // Override specific properties:
  metaData: "observable.ref", // Make metaData reference-observable only
  settings: "observable.shallow", // Make settings a shallow observable

  // You can also use an array syntax for additional options:
  user: ["observable", "structural"], // Observable with structural comparison
})
`]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["In this example, all properties of ",{$$mdtype:"Tag",name:"code",attributes:{},children:["user"]}," and its nested objects are still"," ","deeply observable, but ",{$$mdtype:"Tag",name:"code",attributes:{},children:["metaData"]}," and ",{$$mdtype:"Tag",name:"code",attributes:{},children:["settings"]}," use the specified observation"," ","strategies."]},{name:"Heading",attributes:{level:2,id:"makeobservable-function-explicit-declarations"},children:["MakeObservable Function: Explicit Declarations"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["The ",{$$mdtype:"Tag",name:"code",attributes:{},children:["makeObservable()"]}," function takes the opposite approach: nothing is"," ","observable unless explicitly declared. This gives you precise control over what"," ","properties are observed and how."]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { makeObservable } from "@fobx/core"

const user = makeObservable({
  name: "Alice",
  age: 30,
  profile: {
    avatar: "alice.jpg",
    settings: {
      theme: "dark",
    },
  },
  hobbies: ["reading", "hiking"],

  get fullName() {
    return \`\${this.name}, \${this.age} years old\`
  },
}, {
  name: "observable", // Only name is observable
  age: "observable", // Only age is observable
  fullName: "computed", // Declare computed property
  // profile and hobbies are NOT observable because they're not declared
})

// Changes to declared properties will trigger reactions
user.name = "Bob" // Triggers reactions

// Changes to undeclared properties won't trigger reactions
user.profile.settings.theme = "light" // No reaction triggered
user.hobbies.push("swimming") // No reaction triggered
`]},{name:"Heading",attributes:{level:3,id:"class-example-with-makeobservable"},children:["Class Example with makeObservable"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:[{$$mdtype:"Tag",name:"code",attributes:{},children:["makeObservable"]}," is particularly useful with classes:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { action, computed, makeObservable, observable } from "@fobx/core"

class UserStore {
  name = "Alice"
  age = 30
  hobbies = ["reading", "hiking"]

  constructor() {
    // Must be called in constructor
    makeObservable(this, {
      name: "observable",
      age: "observable",
      hobbies: "observable",
      fullName: "computed",
      updateUser: "action",
    })
  }

  get fullName() {
    return \`\${this.name}, \${this.age} years old\`
  }

  updateUser(name, age) {
    this.name = name
    this.age = age
  }
}

const userStore = new UserStore()
`]},{name:"Heading",attributes:{level:2,id:"choosing-between-observable-and-makeobservable"},children:["Choosing Between observable() and makeObservable()"]},{name:"Heading",attributes:{level:3,id:"when-to-use-observable"},children:["When to use observable():"]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["For simple state objects where most properties should be observable"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["When you want quick setup with minimal boilerplate"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["For data structures where deep reactivity is desired by default"]}]},{name:"Heading",attributes:{level:3,id:"when-to-use-makeobservable"},children:["When to use makeObservable():"]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["When working with classes"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["When you need explicit control over which properties should be reactive"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["To reduce the performance overhead of unnecessary observables"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["For better type safety and code clarity"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["To enforce a stricter pattern of declaring all observable members"]}]},{name:"Heading",attributes:{level:2,id:"observable-property-types"},children:["Observable Property Types"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["Both approaches support the same set of annotations:"]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"code",attributes:{},children:['"observable"']}," - Makes the property deeply observable"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"code",attributes:{},children:['"observable.ref"']}," - Makes only the reference observable, not its contents"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"code",attributes:{},children:['"observable.shallow"']}," - Makes the property observable but keeps the items"," ","inside non-observable"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"code",attributes:{},children:['"computed"']}," - Marks a getter as a computed value"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"code",attributes:{},children:['"action"']}," - Marks a method as an action that can modify state"]}]},{name:"Heading",attributes:{level:2,id:"advanced-configurations"},children:["Advanced Configurations"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["You can also specify custom comparison behavior for properties:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { makeObservable } from "@fobx/core"

const user = makeObservable({
  name: "Alice",
  score: 75,
}, {
  name: "observable",
  // Custom comparison function - only react when score changes by 5 or more
  score: ["observable", (a, b) => Math.abs(a - b) < 5],
})
`]},{name:"Heading",attributes:{level:2,id:"best-practices"},children:["Best Practices"]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!0},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Use makeObservable for classes"]},": It provides clearer code structure and"," ","better type safety"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Use observable for plain data"]},": When you need quick setup of observable"," ","state objects"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Be explicit about annotations"]},": Even with ",{$$mdtype:"Tag",name:"code",attributes:{},children:["observable()"]},", consider"," ","providing annotations for clarity"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Consider performance"]},": Only make properties observable if they need to"," ","trigger reactions"]}]},{name:"Heading",attributes:{level:2,id:"related-documentation"},children:["Related Documentation"]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{name:"Link",attributes:{href:"/fobx/core-docs-shallow-observables"},children:["Shallow Observables"]}," - More detailed information"," ","about shallow observability"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{name:"Link",attributes:{href:"/fobx/core-docs-controlling-comparisons"},children:["Controlling Comparisons"]}," - How to control when"," ","observers react to changes"]}]}]},toc:[{id:"observable-function-automatic-observability",level:2,title:"Observable Function: Automatic Observability",children:[{id:"overriding-default-behavior",level:3,title:"Overriding Default Behavior",children:[]}]},{id:"makeobservable-function-explicit-declarations",level:2,title:"MakeObservable Function: Explicit Declarations",children:[{id:"class-example-with-makeobservable",level:3,title:"Class Example with makeObservable",children:[]}]},{id:"choosing-between-observable-and-makeobservable",level:2,title:"Choosing Between observable() and makeObservable()",children:[{id:"when-to-use-observable",level:3,title:"When to use observable():",children:[]},{id:"when-to-use-makeobservable",level:3,title:"When to use makeObservable():",children:[]}]},{id:"observable-property-types",level:2,title:"Observable Property Types",children:[]},{id:"advanced-configurations",level:2,title:"Advanced Configurations",children:[]},{id:"best-practices",level:2,title:"Best Practices",children:[]},{id:"related-documentation",level:2,title:"Related Documentation",children:[]}]}},navigation:{mainNav:[{label:"Documentation",path:"/"},{label:"GitHub",path:"https://github.com/jereklas/fobx",isExternal:!0}],sidebar:[{title:"Core",items:[{label:"Controlling Comparisons in FobX",path:"/core-docs-controlling-comparisons"},{label:"Creating Observable State in FobX",path:"/core-docs-creating-observable-state"},{label:"Shallow Observables in FobX",path:"/core-docs-shallow-observables"}]}]},lastUpdated:"2025-06-04T06:12:03.194Z"}),document.getElementById("root"));
