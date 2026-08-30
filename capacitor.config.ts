import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dharmamukunthan.situpchallenge",
  appName: "Situp Challenge",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    Camera: {
      androidPermissions: ["android.permission.CAMERA"],
    },
  },
};

export default config;
