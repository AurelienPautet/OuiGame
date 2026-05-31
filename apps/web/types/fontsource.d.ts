// @fontsource* packages are CSS side-effect imports with no type declarations.
// Declaring them keeps `import "@fontsource-variable/fredoka"` happy under
// strict module resolution (TS2882).
declare module "@fontsource-variable/fredoka";
declare module "@fontsource-variable/*";
declare module "@fontsource/*";
