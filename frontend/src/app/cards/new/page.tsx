import { Suspense } from "react";
import { NewCardForm, NewCardFormFallback } from "./new-card-form";

export default function NewCardPage() {
  return (
    <Suspense fallback={<NewCardFormFallback />}>
      <NewCardForm />
    </Suspense>
  );
}
