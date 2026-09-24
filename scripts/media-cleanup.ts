import { getStorageProvider } from '../src/lib/storage';
import { getSupabaseAdminClient } from '../src/lib/db/supabase-client';
import { extractObjectKey } from '../src/lib/media/url';
import { isValidSanboardStorageKey } from '../src/lib/storage/lifecycle';
import { db } from '../src/lib/db/store';

interface ScanReport {
  scannedCount: number;
  referencedCount: number;
  orphanCount: number;
  orphanBytes: number;
  skippedDueToGraceCount: number;
  categories: {
    avatars: string[];
    listings: string[];
    logos: string[];
    banners: string[];
    unknown: string[];
  };
}

async function collectDbReferences(): Promise<Set<string>> {
  const referencedKeys = new Set<string>();

  const addKey = (val?: string | null) => {
    if (!val || typeof val !== 'string') return;
    const extracted = extractObjectKey(val);
    if (extracted && isValidSanboardStorageKey(extracted)) {
      referencedKeys.add(extracted);
    }
  };

  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      // 1. Character avatars
      const { data: profiles } = await client.from('character_profiles').select('avatar_path, avatar_url');
      (profiles || []).forEach((p: any) => {
        addKey(p.avatar_path);
        addKey(p.avatar_url);
      });

      // 2. Corporate logos and banners
      const { data: dealers } = await client
        .from('corporate_profiles')
        .select('logo_path, logo_url, banner_path, banner_url');
      (dealers || []).forEach((d: any) => {
        addKey(d.logo_path);
        addKey(d.logo_url);
        addKey(d.banner_path);
        addKey(d.banner_url);
      });

      // 3. Listing images
      const { data: images } = await client.from('listing_images').select('storage_path');
      (images || []).forEach((i: any) => {
        addKey(i.storage_path);
      });

      return referencedKeys;
    }
  }

  // Memory fallback
  (db.profiles || []).forEach((p) => {
    addKey(p.avatar_path);
    addKey(p.avatar_url);
  });
  (db.dealers || []).forEach((d) => {
    addKey(d.logo_path);
    addKey(d.logo_url);
    addKey(d.banner_path);
    addKey(d.banner_url);
  });
  (db.listings || []).forEach((l) => {
    l.images?.forEach((i) => addKey(i.storage_path));
  });

  return referencedKeys;
}

export async function runOrphanScan(options: {
  execute?: boolean;
  graceHours?: number;
  quiet?: boolean;
}) {
  const execute = Boolean(options.execute);
  const graceHours = options.graceHours !== undefined ? options.graceHours : 24;
  const gracePeriodMs = graceHours * 60 * 60 * 1000;
  const now = Date.now();

  const storage = getStorageProvider();
  const prefixes = ['avatars/', 'listings/', 'dealers/logos/', 'dealers/banners/'];

  const referencedKeys = await collectDbReferences();

  const report: ScanReport = {
    scannedCount: 0,
    referencedCount: 0,
    orphanCount: 0,
    orphanBytes: 0,
    skippedDueToGraceCount: 0,
    categories: {
      avatars: [],
      listings: [],
      logos: [],
      banners: [],
      unknown: [],
    },
  };

  const orphanCandidates: { key: string; size: number }[] = [];

  for (const prefix of prefixes) {
    let continuationToken: string | undefined = undefined;

    if (typeof storage.list !== 'function') break;
    do {
      const page = await storage.list(prefix, continuationToken);
      continuationToken = page.nextContinuationToken;

      for (const item of (page.objects || [])) {
        report.scannedCount++;

        if (referencedKeys.has(item.key)) {
          report.referencedCount++;
          continue;
        }

        // Check grace period
        const itemAgeMs = item.lastModified ? now - item.lastModified.getTime() : Infinity;
        if (itemAgeMs < gracePeriodMs) {
          report.skippedDueToGraceCount++;
          continue;
        }

        // It is an unreferenced orphan candidate
        report.orphanCount++;
        report.orphanBytes += item.size;
        orphanCandidates.push({ key: item.key, size: item.size });

        if (item.key.startsWith('avatars/')) {
          report.categories.avatars.push(item.key);
        } else if (item.key.startsWith('listings/')) {
          report.categories.listings.push(item.key);
        } else if (item.key.startsWith('dealers/logos/')) {
          report.categories.logos.push(item.key);
        } else if (item.key.startsWith('dealers/banners/')) {
          report.categories.banners.push(item.key);
        } else {
          report.categories.unknown.push(item.key);
        }
      }
    } while (continuationToken);
  }

  if (!options.quiet) {
    console.log('====================================================');
    console.log('         SANBOARD R2 MEDIA CLEANUP SCANNER          ');
    console.log('====================================================');
    console.log(`Mode:               ${execute ? 'EXECUTE (PHYSICAL DELETION)' : 'DRY-RUN (NO DELETION)'}`);
    console.log(`Grace Period:       ${graceHours} hours`);
    console.log(`Objects Scanned:    ${report.scannedCount}`);
    console.log(`Valid Referenced:   ${report.referencedCount}`);
    console.log(`Orphan Candidates:  ${report.orphanCount}`);
    console.log(`Grace-Skipped:      ${report.skippedDueToGraceCount}`);
    console.log(`Candidate Size:     ${(report.orphanBytes / (1024 * 1024)).toFixed(2)} MB (${report.orphanBytes} bytes)`);
    console.log('----------------------------------------------------');
    console.log(`- Avatar Orphans:   ${report.categories.avatars.length}`);
    console.log(`- Listing Orphans:  ${report.categories.listings.length}`);
    console.log(`- Logo Orphans:     ${report.categories.logos.length}`);
    console.log(`- Banner Orphans:   ${report.categories.banners.length}`);
    console.log(`- Unknown Orphans:  ${report.categories.unknown.length}`);
    console.log('----------------------------------------------------');

    if (orphanCandidates.length > 0) {
      console.log('Orphan Candidates List:');
      orphanCandidates.slice(0, 25).forEach((c) => {
        console.log(`  [${(c.size / 1024).toFixed(1)} KB] ${c.key}`);
      });
      if (orphanCandidates.length > 25) {
        console.log(`  ... and ${orphanCandidates.length - 25} more.`);
      }
    } else {
      console.log('No orphan candidates found. Storage is clean!');
    }
  }

  if (execute) {
    if (orphanCandidates.length === 0) {
      console.log('Nothing to delete.');
      return report;
    }

    console.log('\n[EXECUTE] Re-validating active references before deletion...');
    const reCheckedRefs = await collectDbReferences();
    let deletedCount = 0;
    let deletedBytes = 0;

    for (const candidate of orphanCandidates) {
      if (reCheckedRefs.has(candidate.key)) {
        console.log(`Skipped newly referenced object: ${candidate.key}`);
        continue;
      }
      try {
        await storage.delete(candidate.key);
        deletedCount++;
        deletedBytes += candidate.size;
      } catch (err: any) {
        console.error(`Failed to delete ${candidate.key}:`, err.message);
      }
    }

    console.log(`Successfully deleted ${deletedCount} orphan objects (${(deletedBytes / (1024 * 1024)).toFixed(2)} MB).`);
  } else if (!options.quiet) {
    console.log('\n[DRY-RUN] No objects were deleted. Use --execute to delete candidate orphans.');
  }

  return report;
}

if (process.argv[1]?.endsWith('media-cleanup.ts')) {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const graceArg = args.find((a) => a.startsWith('--grace-hours='));
  const graceHours = graceArg ? parseFloat(graceArg.split('=')[1]) : 24;

  runOrphanScan({ execute: isExecute, graceHours })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Media cleanup error:', err);
      process.exit(1);
    });
}
