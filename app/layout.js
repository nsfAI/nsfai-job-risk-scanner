export const metadata = {
  title: "NSFAI — Not Safe From AI",
  description: "Task-based AI displacement & augmentation risk scoring for any job."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        {children}
      </body>
    </html>
  );
}
