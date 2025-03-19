# Many Modules MarkDown (MMMD)

Many Modules MarkDown (MMMD) is a new file format to help manage our content for this site. The file extension is `.mmmd`.

MMMD allows us to embed multiple markdown files (including corresponding front-matter) into a single file.

## Why?

We need to accommodate several opposing needs in this site's content.

1. The content needs to be easy to maintain and understand. Ideally editors could directly submit changes in GitHub.
2. But, we don't have time or consensus at the moment around how to build an appropriate CMS.
3. And, many of the pages on this site are "high design", which means regular markdown alone isn't going to cut it.

Before, we split out different parts of each page into separate markdown files. This helped us process content into different specialized sub-designs on the page. For example, for the About page, we had:

* about.njk
* about_we-need-your-voice.md
* about_the-process.md
* about_you-get-the-mic.md
* about_what-you-can-learn.md

This quickly grew too cumbersome as we added more pages.

MMMD lets us combine all of that content into a single file.

## How it works

### Start with standard markdown

You can start with the a normal 11ty-powered markdown file. For example:

```
---
title: Sample MMMD file
description: Nothing fancy yet.
---

Typical markdown content goes here.
```

This part of the file can be used as usual throughout 11ty templates.

### Add an MMMD module

To add a new MMMD "module", add a new section to the bottom.

```
---
title: Sample MMMD file
description: Nothing fancy yet.
---

Typical markdown content goes here.

----
id: myFirstModule
title: Sample MMMD module
arbitraryData: Whatever you want
----

Normal markdown content for the module goes here.

* list item 1
* list item 2
* list item 3

----
id: mySecondModule
title: 2nd sample MMMD module
differentArbitraryData: Still whatever you want
----

Another block of markdown content.
```

Some important notes follow.

* An MMMD module is started by including a new front-matter section, delimited by four dashes (`----`), instead of the usual three.
* Each MMMD module front-matter **must** contain an `id`.
* Many MMMD modules can be added to the same file.

### Use the module in a template

11ty will make this module available for use in templates. Here's an example in nunjucks.

```
<!-- The normal markdown content at top of file still works as usual in templates. -->
<h1>{{ title }}</h1>
<p>{{ description }}</p>

<!-- Here's how to render the module. -->
<section id="section-tag-not-required">
  <h2>{{ modules.myFirstModule.title }}</h2>
  <p>{{ modules.myFirstModule.arbitraryData }}</p>
  <div class="10-deep-div-nest">
    {{ modules.myFirstModule.content | safe }}
  </div>
</section>
```

Recap:

* 11ty will make each of your modules available to templates within the `modules` object.
* Access each module by `id` given in the MMMD file. For example, `modules.myFirstModule`.
* The parsed markdown content for the module will be available via `content`. For example, `module.myFirstModule.content`. 

## Possible problems

We might see problems if dashes are used to create a fourth-level nested list. At this time, the workaround would be to use asterix instead.