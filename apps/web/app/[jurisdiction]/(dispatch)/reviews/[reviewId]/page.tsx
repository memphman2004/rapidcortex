import { PostIncidentReviewEditor } from "@/components/dispatch/reviews/post-incident-review-editor";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  return <PostIncidentReviewEditor reviewId={decodeURIComponent(reviewId)} />;
}
