// CLIENT FILE: every piece of text on the site lives here.
// Values in [square brackets] are placeholders. Replace them once the client sends real data.
// Site copy is written in the client's language. Code comments stay in English.
window.SITE = {
  meta: {
    lang: "en",
    title: "[COMPANY NAME]"
  },

  logo: "LOGO",
  brand: "[COMPANY NAME]",
  // Keep this notice until the client approves the site.
  note: "Sample layout. Content will be replaced after approval.",

  hero: {
    chip: "[Business category]",
    title: "[Main headline]",
    text: "[One or two sentences about the company.]",
    ctaProjects: "See projects",
    ctaContact: "Get in touch"
  },

  // All photos belong to one project. Label renders as such until the project is built.
  project: {
    number: 1,
    chip: "[Project type]",
    title: "[Project name]",
    place: "[City] · [Year]",
    videoButton: "Watch the video"
  },

  photos: [
    { thumb: "[Photo 1]", file: "client/img/photo-1.jpg", alt: "[Describe photo 1]", text: "[One line about photo 1]" },
    { thumb: "[Photo 2]", file: "client/img/photo-2.jpg", alt: "[Describe photo 2]", text: "[One line about photo 2]" },
    { thumb: "[Photo 3]", file: "client/img/photo-3.jpg", alt: "[Describe photo 3]", text: "[One line about photo 3]" },
    { thumb: "[Photo 4]", file: "client/img/photo-4.jpg", alt: "[Describe photo 4]", text: "[One line about photo 4]" }
  ],

  video: {
    title: "[Video headline]",
    caption: "[Video title] · [Length]",
    url: "" // video link, once available
  },

  contact: {
    title: "[Contact headline]",
    whatsapp: "[WhatsApp number]", // final format: 62812xxxxxxx (button turns on automatically)
    email: "[Email]",
    address: "[Office address]",
    director: "[Contact person]",
    button: "Chat on WhatsApp",
    buttonNote: "The button turns on once a WhatsApp number is set.",
    labels: { whatsapp: "WhatsApp", email: "Email", address: "Address", director: "Contact" }
  },

  // Small interface labels (screen readers and controls), in the client's language.
  ui: {
    carousel: "Company profile",
    prev: "Previous slide",
    next: "Next slide",
    goTo: "Go to slide {n}",
    slideOf: "{n} of {total}",
    photoOf: "Project {project} · photo {n} of {total}",
    viewPhoto: "View photo {name}",
    play: "Play video",
    playUnavailable: "Play video (not available yet)"
  }
};
