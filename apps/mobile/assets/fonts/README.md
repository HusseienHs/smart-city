# Fonts

Noto Sans, Noto Sans Hebrew and Noto Sans Arabic by the Noto Project Authors, from
[google/fonts](https://github.com/google/fonts) (`ofl/notosans`, `ofl/notosanshebrew`,
`ofl/notosansarabic`). Licensed under the [SIL Open Font License 1.1](./OFL.txt), which allows
bundling in apps, modification and redistribution. The fonts declare no Reserved Font Name.

Modifications for the app (permitted by the OFL):

- Static instances at weights 400 / 500 / 600 / 700 (width 100) cut from the variable fonts with
  fontTools `instancer`, because React Native needs one family name per weight.
- Noto Sans subset to Latin, Latin Extended, combining marks, general punctuation, currency and
  arrows (Greek, Cyrillic and Vietnamese ranges removed). Hebrew and Arabic keep every glyph and
  all OpenType layout features (Arabic shaping: `init`, `medi`, `fina`, `rlig`, …).
- Each file renamed to a unique family / PostScript name (`NotoSansHebrew-SemiBold`, …) so iOS can
  register all weights side by side.

| Family         | Covers                    | Size (4 weights) |
| -------------- | ------------------------- | ---------------- |
| NotoSans       | English UI                | ~548 KB          |
| NotoSansHebrew | Hebrew UI (+ Basic Latin) | ~172 KB          |
| NotoSansArabic | Arabic UI (+ Basic Latin) | ~688 KB          |
