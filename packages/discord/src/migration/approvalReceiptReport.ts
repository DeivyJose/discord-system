import type {
  ApprovalReceipt,
} from './approvalReceiptTypes.js';

export function renderApprovalReceipt(
  receipt: ApprovalReceipt,
): string {
  const output: string[] = [
    'THE CLOCK — APPROVAL RECEIPT',
    '============================',
    '',
    `Receipt ID: ${receipt.receiptId}`,
    `Verificado: ${receipt.verifiedAt}`,
    `Estado: ${receipt.status}`,
    '',
    `Servidor: ${receipt.guild.name}`,
    `Guild ID: ${receipt.guild.id}`,
    '',
    'PLAN AUTORIZADO',
    '---------------',
    `Fingerprint: ${receipt.gateFingerprint}`,
    `Confirmation ID: ${receipt.manifest.confirmationId ?? '(ninguno)'}`,
    `Manifest creado: ${receipt.manifest.createdAt}`,
    `Manifest expira: ${receipt.manifest.expiresAt}`,
    '',
    'COMPROBACIONES',
    '--------------',
  ];

  for (
    const check
    of receipt.checks
  ) {
    output.push(
      `[${check.status.toUpperCase()}] ${check.id}`,
    );

    output.push(
      `  ${check.details}`,
    );
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `PASS: ${receipt.summary.pass}`,
    `BLOCK: ${receipt.summary.block}`,
    '',
    `Aprobación válida: ${
      receipt.summary.approvalValid
        ? 'SÍ'
        : 'NO'
    }`,
    '',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'Este Receipt demuestra únicamente que una frase válida fue verificada.',
    'No contiene la frase introducida.',
    'No ejecuta ni modifica Discord.',
    '',
  );

  return output.join('\n');
}
