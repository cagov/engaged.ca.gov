import esbuild from "esbuild";
import yaml from "js-yaml";
import { Features as lcssFeatures, bundle as lcssBundle } from "lightningcss";
import { promises as fs } from "node:fs";
import path from "node:path";
import chalk from "chalk";
import markdownIt from "markdown-it";
import translations from './site/_data/i18n.js';
import { EleventyI18nPlugin } from "@11ty/eleventy";
import { readFileSync } from 'node:fs';

/**
 * Log an output from a build process in the 11ty style.
 * @param {string} srcPath The source of the build process.
 * @param {string} distPath The output of the build process.
 * @param {string} assetType The type of build: CSS, JS, etc.
 * @returns {void}
 */
function buildLog(srcPath, distPath, assetType) {
  const projectLabel = chalk.blue("[EngDem]");
  const distLabel = `Writing ./${distPath}`;
  const srcLabel = chalk.gray(`from ./${srcPath} (${assetType})`);

  console.log(`${projectLabel} ${distLabel} ${srcLabel}`);
}

/**
 * Build and bundle CSS.
 * @returns {Promise<void>}
 */
async function buildCSS() {
  const cssFiles = [
    { src: "src/css/index.css", dist: "_dist/css/index.css" },
    { src: "src/css/action-plan.css", dist: "_dist/css/action-plan.css" },
    { src: "src/css/lenis.css", dist: "_dist/css/lenis.css" },
    { src: "src/css/fires.css", dist: "_dist/css/fires.css" },
    { src: "src/css/fires-summary.css", dist: "_dist/css/fires-summary.css" },
    { src: "src/css/state-employees.css", dist: "_dist/css/state-employees.css" }
  ];

  for (const file of cssFiles) {
    const { code, map } = lcssBundle({
      filename: file.src,
      include: lcssFeatures.Nesting,
      minify: true,
    });

    buildLog(file.src, file.dist, "CSS");

    await fs.mkdir(path.dirname(file.dist), { recursive: true });
    await fs.writeFile(file.dist, code);
  }
}

/**
 * Build and bundle JavaScript.
 * @returns {Promise<void>}
 */
async function buildJS() {
  const srcPath = "src/js/index.js";
  const distPath = "_dist/js/index.js";

  buildLog(srcPath, distPath, "JavaScript");

  await esbuild.build({
    entryPoints: [srcPath],
    bundle: true,
    outfile: distPath,
    minify: true,
  });
}

const markdownEngine = markdownIt({
  html: true,
  breaks: false,
  linkify: true,
});

let firstBuild = true;

export default async function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyI18nPlugin, {
    defaultLanguage: "en",
    errorMode: "allow-fallback"
  });

  eleventyConfig.on("eleventy.before", async ({ runMode }) => {
    // Only build all of the bundle files during first run, not on every change.
    // if (firstBuild || runMode !== "serve") {
      await buildCSS();
      await buildJS();
    //   firstBuild = false;
    // }
  });

  eleventyConfig.on("eleventy.beforeWatch", async (changedFiles) => {
    // During development changes, only reload the bundles that need reloading.
    for (const changedFile of changedFiles) {
      if (changedFile.endsWith(".css")) await buildCSS();
      if (changedFile.endsWith(".js")) await buildJS();
    }
  });

  eleventyConfig.addFilter('i18n', function (key, localeOverride) {
    const page = this.page || this.ctx.page;
    const locale = localeOverride || page.lang;
    const contentGroup = translations[key];

    // Check if the requested content key exists.
    if (!contentGroup) {
      console.log(chalk.yellow(`[i18n] Could not find content group for *${key}* in translations table.`));
      return "";
    }

    // Get content in desired language.
    const idealContentString = contentGroup[locale];

    // English fallback if needed.
    if (!idealContentString) {
      console.log(chalk.yellow(`[i18n] Could not find *${locale}* content for *${key}* in translations table. Falling back to English.`));
      return contentGroup.en;
    }

    return idealContentString;
  });

  // Used to provide domain for canonical and oscial media tags
  // domain is currently undefined
  eleventyConfig.addFilter("changeDomain", (url, domain) => {
    // console.log("changeDomain", url, domain);
    try {
      const u = new URL(url, `https://${domain}`);
      u.host = domain;
      return u.href;
    } catch {
      return url;
    }
  });

  // Used in language switcher to get the path to the appropriate for current URL
  eleventyConfig.addFilter("pagePath", (page, langPath) => {
    let currentPath = `${page.filePathStem}/`; // Relative to base dir, localized path, with folder + /index.html.

    const languages = ["/en/","/es/","/ko/","/tl/","/vi/","/zh-hans/","/zh-hant/","/fa/","/hy/"]; // Localized folder paths, '/es/', '/vi', etc.

    languages.map((language) => {
      currentPath = currentPath.replace(language, "/"); // Remove existing localized paths to get root.
    });

    // Remove /home/ path slug from filePathStem variable
    if (currentPath.startsWith('/')) {
      currentPath = currentPath.slice(1);
    }
    currentPath = langPath + currentPath;
    // Return a path with no localization and index.html
    currentPath = currentPath.replace('/homepage/', '/');
    currentPath = currentPath.replace('/en/', '/');
    return currentPath;
  });

  // used in header to provide canonical path and social media sharing url
  eleventyConfig.addFilter("relativePath", (page, locale) => {
    let currentPath = `${page.filePathStem}/`; // Relative to base dir, localized path, with folder + /index.html.
    // Remove /homepage/ and /en/ from current paths
    currentPath = currentPath.replace('/homepage/', '/');
    currentPath = currentPath.replace('/en/', '/');
    // console.log("relativePath fileSlug=", page.fileSlug, " filePathStem=", page.filePathStem, " -->", currentPath);
    // Return a path with localization and index.html
    return currentPath;
  });

  eleventyConfig.addFilter("langPathActive", (page, lang, locale) => {
    if (page.fileSlug.includes('sitemap')) {
      return false;
    }
    if (lang === locale) {
      return false;
    }
    return true;
  });

  // used to fix links in pages to point to the correct localized path for the locale
  eleventyConfig.addFilter("localizedPath", (path, locale) => {
    const localeFolder = `/${locale}`;

    // if path starts with /en, remove it
    const normalizedPath = path.startsWith("/en") ? path.slice(3) : path;
    let currentPath = localeFolder + normalizedPath; // Relative to base dir, localized path, with folder.

    // console.log("localizedPath", path, localeFolder, currentPath);
    // Add a slash only when it is merited
    if (!currentPath.endsWith("/") && currentPath.indexOf('#') === -1) {
      currentPath += "/";
    }
    currentPath = currentPath.replace('/homepage/', '/');
    currentPath = currentPath.replace('/en/', '/');
    // console.log("localizedPath", path, localeFolder, currentPath);
    // Return a path with localization and index.html
    return currentPath;
  });

  // New file format: MMMD (Many Modules MarkDown)
  // Allows embedding sub-documents into a Markdown file, including front-matter data.
  eleventyConfig.addTemplateFormats("mmmd");
  eleventyConfig.addExtension("mmmd", {
		compile: async (inputContent) => {
      // Remove all the modules.
      const rootMarkdown = inputContent.replaceAll(/----(.+?)----(.*?)(?=----|\s*$)/gs, "");
      // Render the base markdown.
      const output = markdownEngine.render(rootMarkdown);
      // Insert into the typical 11ty content flow.
			return async () => output;
		},
    getData: async (inputPath) => {
      try {
        const content = await fs.readFile(inputPath, "utf-8");
        const matches = [...content.matchAll(/----(.+?)----(.*?)(?=----|\s*$)/gs)];

        // Process mmmd modules for inclusion in 11ty data cascade.
        const modules = matches.reduce((bucket, match) => {
          const capturedData = match[1] || "";
          const data = yaml.load(capturedData);
          const capturedContent = match[2] || "";
          const content = markdownEngine.render(capturedContent);

          const moduleId = data?.id;

          // The module ID is required.
          if (!moduleId) {
            console.warn('MMMD module found without ID. Skipping.');
          }

          bucket[moduleId] = {
            ...data,
            content
          }

          return bucket;
        }, {});

        return {
          modules
        }
      } catch (e) {
        console.log(`ERROR: ${inputPath}`);
        throw e;
      }
    }
	});
  // Add filter to read file contents
  eleventyConfig.addFilter('getFileContents', (filePath) => {
    try {
      return readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error(`Error reading file ${filePath}:`, err);
      return `<!-- Error reading SVG file: ${err.message} -->`;
    }
  });

  eleventyConfig.addGlobalData("layout", "layout");

  eleventyConfig.addPassthroughCopy({
    "src/public": "public",
    "src/root": "/"
  });

  eleventyConfig.addWatchTarget("./src");
  eleventyConfig.addWatchTarget("./site");
  eleventyConfig.addWatchTarget("./src/data/barchart.json");

  eleventyConfig.setLibrary("md", markdownEngine);

  return {
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["html", "njk", "11ty.js", "md"],
    dir: {
      input: "site",
      includes: "_includes",
      output: "_dist",
      data: "_data",
    },
  };
}
