# Design source files

Editable originals (Photoshop `.psd`, Paint.NET `.pdn`) used to generate the
game's PNG assets. They are **not** shipped with the app — exported PNGs live in
`Client/public/ressources/image/`.

- `block/` — level block / cube tiles and the playfield background.
- `tank_player/` — tank body and turret sprites.

When you change a source file here, re-export the affected PNGs into the
matching `Client/public/ressources/image/...` folder.

> These are the only design binaries tracked in git; the repo's `.gitignore`
> ignores `*.psd`/`*.pdn` everywhere else so they don't creep back into the app
> folders (where Vite would bundle them into the production build).
