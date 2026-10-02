import mongoose from "mongoose";
import {
  computeProblemIdentityFingerprint,
  defaultFamilyKey,
  generateProblemKey,
} from "./problemIdentity.js";

const ORIGINAL_MODEL = mongoose.model.bind(mongoose);
let installed = false;

function addIdentityFields(schema) {
  if (schema.path("problemKey")) return;

  schema.add({
    problemKey: {
      type: String,
      required: true,
      immutable: true,
      unique: true,
      index: true,
      trim: true,
    },
    familyKey: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    variantOf: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    identityFingerprint: {
      type: String,
      required: true,
      index: true,
      trim: true,
      match: /^[a-f0-9]{64}$/,
    },
  });

  schema.pre("validate", function () {
    if (!this.problemKey) this.problemKey = generateProblemKey();
    if (!this.familyKey) this.familyKey = defaultFamilyKey(this.problemKey);
    if (this.variantOf === this.problemKey) {
      this.invalidate("variantOf", "variantOf cannot reference the same problemKey");
    }
    this.identityFingerprint = computeProblemIdentityFingerprint(this);
  });

  schema.pre("findOneAndUpdate", async function () {
    const update = this.getUpdate() || {};
    const setDoc = update.$set ?? update;
    const existing = await this.model.findOne(this.getQuery()).lean();
    const merged = { ...(existing || {}), ...setDoc };

    if (!merged.problemKey) merged.problemKey = generateProblemKey();
    if (!merged.familyKey) merged.familyKey = defaultFamilyKey(merged.problemKey);
    if (merged.variantOf === merged.problemKey) {
      throw new Error("variantOf cannot reference the same problemKey");
    }
    merged.identityFingerprint = computeProblemIdentityFingerprint(merged);

    update.$set = {
      ...(update.$set || {}),
      problemKey: existing?.problemKey || merged.problemKey,
      familyKey: merged.familyKey,
      variantOf: merged.variantOf ?? null,
      identityFingerprint: merged.identityFingerprint,
    };
    this.setUpdate(update);
  });
}

if (!installed) {
  mongoose.model = function patchedModel(name, schema, collection, options) {
    if (name === "Problem" && schema) addIdentityFields(schema);
    return ORIGINAL_MODEL(name, schema, collection, options);
  };
  installed = true;
}
