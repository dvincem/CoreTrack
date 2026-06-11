const s3 = require('sqlite3');
const db = new s3.Database('./tire_shop.db');

// Step 1: backfill from item_master.design (most reliable)
db.run(
  `UPDATE recap_job_master
   SET recap_type = CASE
     WHEN (SELECT design FROM item_master WHERE item_id = recap_job_master.finished_item_id) = 'TOPCAP'       THEN 'Topcap'
     WHEN (SELECT design FROM item_master WHERE item_id = recap_job_master.finished_item_id) = 'FULLCAP'      THEN 'Fullcap'
     WHEN (SELECT design FROM item_master WHERE item_id = recap_job_master.finished_item_id) = 'COLD PROCESS' THEN 'Cold Process'
     ELSE recap_type
   END
   WHERE recap_type IS NULL
     AND finished_item_id IS NOT NULL
     AND (SELECT design FROM item_master WHERE item_id = recap_job_master.finished_item_id) IS NOT NULL`,
  function(e) {
    if (e) { console.log('Step1 Error:', e.message); db.close(); return; }
    console.log('Step 1 (from design):', this.changes, 'rows updated');

    // Step 2: catch any still-null by parsing casing_description text
    db.run(
      `UPDATE recap_job_master
       SET recap_type = CASE
         WHEN UPPER(casing_description) LIKE '%FULLCAP%'      THEN 'Fullcap'
         WHEN UPPER(casing_description) LIKE '%COLD PROCESS%' THEN 'Cold Process'
         WHEN UPPER(casing_description) LIKE '%TOPCAP%'       THEN 'Topcap'
         ELSE recap_type
       END
       WHERE recap_type IS NULL AND casing_description IS NOT NULL`,
      function(e2) {
        if (e2) console.log('Step2 Error:', e2.message);
        else console.log('Step 2 (from description):', this.changes, 'rows updated');

        db.all('SELECT recap_type, COUNT(*) as cnt FROM recap_job_master GROUP BY recap_type', [], (_, rows) => {
          console.log('Final recap_type breakdown:', JSON.stringify(rows));
          db.close();
        });
      }
    );
  }
);
