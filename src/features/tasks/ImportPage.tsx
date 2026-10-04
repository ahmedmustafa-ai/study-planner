import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { db } from '@/lib/db';
import { useSubjects } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field, PageHeader } from '@/components/common';
import { toast } from '@/components/toast';
import { guessMapping, mapRows, type ColumnMapping } from '@/lib/algorithms/csvMap';
import { formatDate, shareOrDownload } from '@/lib/utils';

const TEMPLATE_CSV = 'Title,Due Date,Class,Priority\nWorksheet 2.1 derivatives,2026-10-02,AP Calculus AB,high\nLab report: reaction rates,10/9/2026,Chemistry,med\n';

/** Generic CSV → tasks importer. Works with a teacher's Classroom export or any Google Sheet you download as CSV. */
export function ImportPage() {
  const navigate = useNavigate();
  const subjects = useSubjects() ?? [];
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ title: '' });
  const [defaultSubject, setDefaultSubject] = useState<number | ''>('');
  const [fileName, setFileName] = useState('');

  function onFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields ?? [];
        setHeaders(hs);
        setRows(res.data);
        setMapping(guessMapping(hs));
        if (!hs.length) toast('No header row found');
      },
      error: (err) => toast(`Could not read CSV: ${err.message}`),
    });
  }

  const defaultId = defaultSubject || subjects[0]?.id;
  const mapped = useMemo(() => (mapping.title && defaultId ? mapRows(rows, mapping, subjects, defaultId) : []), [rows, mapping, subjects, defaultId]);
  const subjectName = (id: number) => subjects.find((s) => s.id === id)?.name;

  async function doImport() {
    if (!mapped.length) return;
    await db.tasks.bulkAdd(mapped.map((m) => m.task));
    toast(`Imported ${mapped.length} tasks`);
    navigate('/tasks');
  }

  const colSelect = (key: keyof ColumnMapping, label: string, optional = true) => (
    <Field label={label}>
      <Select value={mapping[key] ?? ''} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value || undefined })}>
        {optional && <option value="">— none —</option>}
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <>
      <PageHeader back title="Import tasks from CSV" subtitle="Classroom export, Google Sheets, anything with a header row" />
      <Card className="mb-4 space-y-3 p-4">
        <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <p className="text-xs text-muted-foreground">
          Tip: no export available? Keep a Google Sheet with columns Title, Due Date, Class, Priority → File → Download → CSV.
        </p>
        <Button variant="outline" size="sm" onClick={() => shareOrDownload('study-os-tasks-template.csv', TEMPLATE_CSV, 'text/csv')}>
          Get template CSV
        </Button>
      </Card>

      {headers.length > 0 && (
        <>
          <Card className="mb-4 space-y-3 p-4">
            <div className="text-sm font-medium">
              Map columns · {fileName} ({rows.length} rows)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {colSelect('title', 'Title *', false)}
              {colSelect('dueDate', 'Due date')}
              {colSelect('subject', 'Subject / class')}
              {colSelect('priority', 'Priority')}
            </div>
            <Field label="Default subject" hint="Used when the row has no subject or it doesn't match one of yours.">
              <Select value={defaultId ?? ''} onChange={(e) => setDefaultSubject(Number(e.target.value))}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          <div className="mb-2 text-sm font-medium">Preview ({mapped.length} tasks)</div>
          <div className="mb-4 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="p-2">Title</th>
                  <th className="p-2">Due</th>
                  <th className="p-2">Subject</th>
                  <th className="p-2">Pri.</th>
                </tr>
              </thead>
              <tbody>
                {mapped.slice(0, 15).map((m, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2">
                      {m.task.title}
                      {m.warnings.map((w) => (
                        <div key={w} className="text-xs text-tag-yellow-fg">
                          {w}
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap p-2">{formatDate(m.task.dueDate) || '—'}</td>
                    <td className="p-2">{subjectName(m.task.subjectId)}</td>
                    <td className="p-2">{m.task.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mapped.length > 15 && <div className="border-t p-2 text-xs text-muted-foreground">…and {mapped.length - 15} more</div>}
          </div>
          <Button className="w-full" disabled={!mapped.length} onClick={doImport}>
            Import {mapped.length} tasks
          </Button>
        </>
      )}
    </>
  );
}
