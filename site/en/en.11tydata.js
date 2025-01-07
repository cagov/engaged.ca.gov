export default {
  eleventyComputed: {
    permalink: (item) =>
      item.permalink === false ? false : `/${item.page.fileSlug}/`,
  },
};
