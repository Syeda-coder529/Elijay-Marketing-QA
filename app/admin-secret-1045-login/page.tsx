import LoginForm from "@/components/LoginForm";
import LoginIllustration from "@/components/LoginIllustration";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-12 px-4">
      <LoginIllustration />
      <LoginForm
        role="admin"
        title="Admin Portal"
        subtitle="Restricted access"
        idLabel="Username"
        redirectTo="/admin/dashboard"
      />
    </div>
  );
}
