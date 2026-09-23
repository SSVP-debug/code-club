import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";
import User from "./User.js";

// Regression coverage for the referralCode sparse-index incident: `default:
// null` on a `unique: true, sparse: true` field made every new user's
// document contain `referralCode: null`, and a sparse index only ignores
// documents where the field is ABSENT — not documents where it's null. The
// second user ever created collided with the first on the index's one
// allowed null slot (E11000). See models/User.js's referralCode comment for
// the full incident writeup this test suite exists to protect.
describe("User model — referralCode field (sparse-index regression)", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  it("allows creating multiple users without a referralCode, with no duplicate-key error", async () => {
    const userA = await User.create({ firebaseUid: "fb-a", email: "a@test.com" });
    const userB = await User.create({ firebaseUid: "fb-b", email: "b@test.com" });

    expect(userA._id).toBeTruthy();
    expect(userB._id).toBeTruthy();
    expect(userA.referralCode).toBeUndefined();
    expect(userB.referralCode).toBeUndefined();
  });

  it("does not persist a referralCode field until one is explicitly generated", async () => {
    const created = await User.create({ firebaseUid: "fb-c", email: "c@test.com" });

    const reloaded = await User.findById(created._id).lean();

    // Deliberately not `.toBeNull()` — the whole bug was `null` being
    // present. This asserts the key is genuinely absent from the stored
    // document, which is what makes the sparse index skip it.
    expect(Object.prototype.hasOwnProperty.call(reloaded, "referralCode")).toBe(false);
  });

  it("defaults visibleToTpo to true for existing and newly created users", async () => {
    const created = await User.create({ firebaseUid: "fb-d", email: "d@test.com" });

    expect(created.visibleToTpo).toBe(true);

    const reloaded = await User.findById(created._id).lean();
    expect(reloaded.visibleToTpo).toBe(true);
  });

  it("persists a TPO opt-out independently from public profile visibility", async () => {
    const created = await User.create({
      firebaseUid: "fb-e",
      email: "e@test.com",
      isProfilePublic: false,
      visibleToTpo: false,
    });

    const reloaded = await User.findById(created._id).lean();

    expect(reloaded.isProfilePublic).toBe(false);
    expect(reloaded.visibleToTpo).toBe(false);
  });

});