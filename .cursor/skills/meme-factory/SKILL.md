---
name: meme-factory
description: Generate workout memes as images using the memegen.link API. Use when the user asks for a meme, says "meme-factory", or requests a workout/gym meme.
---

# Meme Factory

Create classic top/bottom text memes as images with memegen.link.

## Quick Start

1. Pick a template.
2. Write short top and bottom text (2-6 words each).
3. Encode the text and build the URL.
4. Reply with the image.

## URL Format

```
https://api.memegen.link/images/{template}/{top}/{bottom}.png
```

Example:
```
https://api.memegen.link/images/buzz/one_more_set/whole_new_workout.png
```

## Text Encoding

| Character | Encoding |
|-----------|----------|
| Space | `_` or `-` |
| Newline | `~n` |
| Question mark | `~q` |
| Percent | `~p` |
| Slash | `~s` |
| Hash | `~h` |
| Single quote | `''` |
| Double quote | `""` |

## Template Suggestions

| Template | Use Case |
|----------|----------|
| `buzz` | "X, X everywhere" |
| `drake` | Reject/approve comparison |
| `success` | Wins and PRs |
| `fine` | Everything is fine |
| `fry` | Not sure if... |
| `changemind` | Hot take |
| `mordor` | "One does not simply..." |

## Response Format

Return the meme as a markdown image:

```
![Meme](https://api.memegen.link/images/buzz/one_more_set/whole_new_workout.png)
```

## Checklist

- [ ] Template matches the joke
- [ ] Text is concise and readable
- [ ] Special characters are encoded
- [ ] URL ends with `.png`
