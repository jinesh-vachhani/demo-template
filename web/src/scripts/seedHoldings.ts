import "dotenv/config";
import connectDatabase from "../config/database";
import User from "../models/userModel";
import Holding from "../models/holdingModel";

const TEST_USER = {
  name: "Test User",
  email: "test@apax.dev",
  gender: "other",
  password: "password123",
};

const DUMMY_HOLDINGS: { assetType: "gold" | "silver" | "platinum"; amount: number }[] = [
  { assetType: "gold", amount: 12.4 },
  { assetType: "silver", amount: 300 },
  { assetType: "platinum", amount: 2.1 },
];

const seed = async () => {
  await connectDatabase();

  let user = await User.findOne({ email: TEST_USER.email });
  if (!user) {
    user = await User.create(TEST_USER);
    console.log(`Created test user: ${TEST_USER.email} / ${TEST_USER.password}`);
  } else {
    console.log(`Using existing test user: ${TEST_USER.email}`);
  }

  for (const holding of DUMMY_HOLDINGS) {
    await Holding.findOneAndUpdate(
      { userId: user._id, assetType: holding.assetType },
      { userId: user._id, assetType: holding.assetType, amount: holding.amount, updatedAt: new Date() },
      { upsert: true, returnDocument: "after" }
    );
  }

  console.log(`Seeded ${DUMMY_HOLDINGS.length} holdings for ${TEST_USER.email}`);
  process.exit(0);
};

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
