export default {
  eleventyComputed: {
    permalink: (item) =>
      item.permalink === false ? false : `/es/${item.page.fileSlug}/`,
  },
};
