export default {
  eleventyComputed: {
    // Render the English pages at root of the site, without /en/ prefixing the path.
    permalink: (item) =>
      item.permalink === false || item.permalink === "/" ? item.permalink : `/${item.page.filePathStem.replace("/en/", "/")}/`,
  },
};
