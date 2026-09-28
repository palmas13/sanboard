import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getOfferRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  const actor=await resolveOwnedActiveProfile(req); if(!actor.ok)return NextResponse.json({error:actor.error},{status:actor.status});
  const countOnly=req.nextUrl.searchParams.get('countOnly')==='1'; const repo=getOfferRepository();
  await repo.expireStale();
  if(countOnly){const counts=await repo.getUnreadCounts(actor.profileId);return NextResponse.json({unreadCount:counts.total,unreadCounts:counts});}
  const listingId=req.nextUrl.searchParams.get('listingId');
  if(listingId)return NextResponse.json({activeCount:await repo.getActiveCountForListing(listingId,actor.profileId)});
  const threadListingId=req.nextUrl.searchParams.get('threadForListing');
  if(threadListingId)return NextResponse.json({thread:await repo.getActiveThreadForListing(threadListingId,actor.profileId)});
  const result=await repo.listOffers({actorProfileId:actor.profileId,box:req.nextUrl.searchParams.get('box')==='sent'?'sent':'received',status:req.nextUrl.searchParams.get('status')||undefined,cursor:req.nextUrl.searchParams.get('cursor')||undefined});
  return NextResponse.json(result);
}
export async function POST(req: NextRequest){const actor=await resolveOwnedActiveProfile(req);if(!actor.ok)return NextResponse.json({error:actor.error},{status:actor.status});const body=await req.json().catch(()=>({}));const result=await getOfferRepository().createOffer({listingId:String(body.listingId||''),amount:Number(body.amount),actorProfileId:actor.profileId,actorUserId:actor.userId});return NextResponse.json(result,{status:result.success?200:400});}