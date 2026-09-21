import LoginForm from "@/components/LoginForm";
import LoginIllustration from "@/components/LoginIllustration";

export default function BuyerLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-12 px-4">
      <LoginIllustration />
      <LoginForm
        role="buyer"
        title="Buyer Portal"
        subtitle="Log in with your Target ID to view calls routed to you"
        idLabel="Target ID"
        redirectTo="/buyer/dashboard"
      />
    </div>
  );
}
