import LoginForm from "@/components/LoginForm";
import LoginIllustration from "@/components/LoginIllustration";

export default function PublisherLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-12 px-4">
      <LoginIllustration />
      <LoginForm
        role="publisher"
        title="Publisher Portal"
        subtitle="Log in with your Publisher ID to view your call performance"
        idLabel="Publisher ID"
        redirectTo="/publisher/dashboard"
      />
    </div>
  );
}
