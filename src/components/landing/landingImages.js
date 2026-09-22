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
  hero: "/images/landing/hero-student.webp",
  ecosystem: "/images/landing/ecosystem-campus.webp",
  tpo: "/images/landing/tpo-placement.webp",
  recruiter: "/images/landing/recruiter-interview.webp",
  graduation: "/images/landing/graduation-caps.webp",
};

export default LANDING_IMAGES;
