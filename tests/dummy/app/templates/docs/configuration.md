# Configuration

An application can decide whether to enable ember-milestones for a build or not by passing configuration in `ember-cli-build.js`.
If ember-milestones is disabled, none of its runtime files will be included in the build, and all `milestone()` calls in your source code will be stripped out and replaced with an immediate invocation of the given callback.

The `enabled` flag defaults to `false` in production and `true` otherwise, with the goal being that ember-milestones is a zero-cost abstraction in production builds.

```js
new EmberApp(defaults, {
  milestones: {
    enabled: EmberApp.env() !== 'production'
  }
});
```
