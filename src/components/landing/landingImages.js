/**
 * Landing imagery registry.
 *
 * Keep image paths centralized so sections can gain or lose imagery without
 * changing their layout/content code. Empty values are intentional: the
 * landing page supports a polished no-image state until approved assets are
 * added.
 *
 * Expected asset locations:
 *   /images/landing/hero-student.webp
 *   /images/landing/ecosystem-campus.webp
 *   /images/landing/tpo-placement.webp
 *   /images/landing/recruiter-interview.webp
 *   /images/landing/graduation-caps.webp
 */
export const LANDING_IMAGES = {
  hero: "",
  ecosystem: "",
  tpo: "",
  recruiter: "",
  graduation: "",
};

export default LANDING_IMAGES;
