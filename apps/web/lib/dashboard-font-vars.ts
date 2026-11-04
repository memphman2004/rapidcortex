/**
 * Runtime Google Fonts stylesheet for dashboard preference stacks.
 * Avoid next/font/google at build time — CodeBuild Docker often fails with
 * TypeError: Cannot read properties of null (reading '1') in the Google font loader.
 */
export const DASHBOARD_GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=IBM+Plex+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";
