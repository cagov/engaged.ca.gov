import esbuild from "esbuild";
import { Features as lcssFeatures, bundle as lcssBundle } from "lightningcss";
import { promises as fs } from "node:fs";
import path from "node:path";
import chalk from "chalk";
import markdownIt from "markdown-it";

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
  const srcPath = "src/css/index.css";
  const distPath = "_dist/css/index.css";

  const { code, map } = lcssBundle({
    filename: srcPath,
    include: lcssFeatures.Nesting,
    minify: true,
  });

  buildLog(srcPath, distPath, "CSS");

  await fs.mkdir(path.dirname(distPath), { recursive: true });
  await fs.writeFile(distPath, code);
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
  eleventyConfig.on("eleventy.before", async ({ runMode }) => {
    // Only build all of the bundle files during first run, not on every change.
    if (firstBuild || runMode !== "serve") {
      await buildCSS();
      await buildJS();
      firstBuild = false;
    }
  });

  eleventyConfig.on("eleventy.beforeWatch", async (changedFiles) => {
    // During development changes, only reload the bundles that need reloading.
    for (const changedFile of changedFiles) {
      if (changedFile.endsWith(".css")) await buildCSS();
      if (changedFile.endsWith(".js")) await buildJS();
    }
  });

  eleventyConfig.addFilter("findByUrl", (collection, url) => {
    const page = collection.find((item) => item?.url === url);
    return page;
  });

  eleventyConfig.addFilter("getSnippet", (collection, fileSlug) => {
    const page = collection.find((item) => item?.page?.fileSlug === fileSlug);
    const htmlContent = markdownEngine.render(page.page.rawInput);
    return Object.assign(page, { htmlContent });
  });

  eleventyConfig.addGlobalData("layout", "layout");

  eleventyConfig.addPassthroughCopy({
    "src/public": "public",
    "src/root": "/"
  });

  eleventyConfig.addWatchTarget("./src");
  eleventyConfig.addWatchTarget("./site");

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
