# Identity spike 01

Model: muse-spark-1.3, reasoning low · images: 256 px reference, 384 px crop (JPEG)

| Request shape | Mug crop vs mug reference | Pen crop vs mug reference |
|---|---|---|
| A data URL, enum schema | MUG1 · 4733 ms | unknown · 2440 ms |
| B data URL with detail auto | MUG1 · 3633 ms | unknown · 2325 ms |
| C data URL, plain string schema | MUG1 · 2999 ms | unknown · 2250 ms |
| D uploaded file as input_image | MUG1 · 3710 ms | unknown · 2762 ms |
| E uploaded file as input_file | MUG1 · 6018 ms | unknown · 3667 ms |

Findings
- Muse Spark accepts images as inline data URLs and as uploaded files; every shape answered correctly.
- Uploading adds a request without making the answer faster, so images are sent inline.
- The verified shape is one text part followed by the images. The first /api/identify version
  interleaved a text label before every image and returned ERROR within 2 s; it now lists the
  image order in a single text part.