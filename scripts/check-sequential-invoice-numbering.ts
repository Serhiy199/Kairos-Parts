import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const schema = read('prisma/schema.prisma');
const service = read('lib/invoices/service.ts');
const migration = read('prisma/migrations/20260721100000_add_sequential_invoice_numbers/migration.sql');

const checks = [
  {
    name: 'invoice number remains a unique String with a database sequence default',
    pass: /invoiceNumber\s+String\s+@unique\s+@default\(dbgenerated\("nextval\('invoice_number_seq'::regclass\)::text"\)\)/.test(schema)
  },
  {
    name: 'legacy request-scoped generator is removed',
    pass: !service.includes('generateInvoiceNumber') && !service.includes('-INV-') && !service.includes('padStart(2')
  },
  {
    name: 'invoice creation delegates invoiceNumber to the database default',
    pass: !/data:\s*\{[\s\S]*?invoiceNumber[\s\S]*?currency:\s*'UAH'/.test(service)
  },
  {
    name: 'migration backfill is deterministic',
    pass: migration.includes('ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC)')
  },
  {
    name: 'migration preserves uniqueness',
    pass: migration.includes('CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber")')
  },
  {
    name: 'sequence advances to N + 1 without reusing values',
    pass: migration.includes('MAX("invoiceNumber"::BIGINT)')
      && migration.includes("nextval('invoice_number_seq'::regclass)::TEXT")
      && migration.includes('false')
  }
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'}: ${check.name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
