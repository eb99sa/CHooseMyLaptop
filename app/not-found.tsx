import Link from "next/link";
import { StateView } from "@/components/ui/StateView";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
      <StateView
        icon="search"
        title="الصفحة مو موجودة"
        body="الرابط اللي تدوّر عليه مو متوفّر أو تغيّر. ارجع للرئيسية وكمّل من هناك."
      >
        <Link href="/" className="btn btn-primary">
          الرئيسية
        </Link>
      </StateView>
    </main>
  );
}
