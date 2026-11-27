# Product

## Users

People who run Minecraft servers, from someone hosting friends on a spare PC to staff on a network with thousands of players. They arrive from a search ("minecraft gradient text", "aikar flags"), a link a friend or a plugin's docs shared, or Xena Studios' other projects.

- **Owners and admins** setting up or tuning a server: start scripts, configs, MOTDs, icons, diagnosing crashes.
- **Staff and builders** writing chat formats, ranks, holograms, scoreboards and item names.
- **Plugin developers** checking how a piece of text will render, or converting between formats.

Most are technical or getting there. They want the answer and the output, and to get back to their server. Many are on a phone with the server console open elsewhere.

## Product purpose

Every tool does one job: give it your input, see a true-to-game preview, copy the output in the exact format your server or plugin reads. It's free, has no account, no ads and no upload: everything that can run in the browser does, and the link holds the settings, so sharing a link shares the result.

Success: someone lands on a tool from a search and has working output in their clipboard in under ten seconds, and comes back to the site next time instead of searching.

## Brand personality

**Exact, quick, quietly helpful.** Like a senior admin who answers with the right command and one line of why. Plain words, real file and plugin names, no hype. The same voice as [xenastudios.co](https://xenastudios.co): technical, honest, open about what's open.

## Anti-references

- **Ad-heavy tool sites:** pop-ups, cookie walls, three ads per tool, a "download" button that isn't.
- **Gamer RGB / neon:** glows, angled panels, pixel-art UI chrome. The game's look belongs inside previews only.
- **Outdated generators:** pre-1.16 assumptions, NBT where 1.20.5+ uses components, JSON that 1.21.5 no longer reads.

## Design principles

1. **Output first.** The preview and the copy button are on screen without scrolling, on a phone too.
2. **Right by default.** Defaults that work on a current Paper server. Choices explain themselves in a few words ("Essentials, CMI…"), not jargon.
3. **True to the game.** Previews follow the game's rules (colours reset formatting, the shadow is a quarter the colour), and say plainly where they're only close (the font).
4. **Nothing leaves the browser unless it must.** Pasted logs and configs are parsed locally. The few tools that need a server say so.
5. **One tool, one page, one job.** No tool grows a second purpose; that's a new tool.

## Accessibility

WCAG 2.2 AA: body text at least 4.5:1, visible focus on every control, full keyboard use (⌘K/Ctrl+K opens search), semantic headings and landmarks, reduced motion respected (obfuscated text stops churning). Colour never carries meaning alone: the preview is always paired with the text output.
