const asyncHandler = require("express-async-handler");
const User = require("../models/User");

// @desc Get my wishlist
// @route GET /api/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "wishlist",
    match: { status: "active" },
  });
  res.json(user.wishlist);
});

// @desc Toggle a product in/out of wishlist
// @route POST /api/wishlist/:productId
const toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const user = await User.findById(req.user._id);
  const idx = user.wishlist.findIndex((id) => id.toString() === productId);
  let added;
  if (idx > -1) {
    user.wishlist.splice(idx, 1);
    added = false;
  } else {
    user.wishlist.push(productId);
    added = true;
  }
  await user.save();
  res.json({ added, wishlist: user.wishlist });
});

module.exports = { getWishlist, toggleWishlist };
