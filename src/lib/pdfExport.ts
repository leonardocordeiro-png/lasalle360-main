import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CouncilPDFData {
  council: any;
  students: any[];
  grades: any[];
  subjects: any[];
  actions: any[];
}

export const exportCouncilToPDF = async (data: CouncilPDFData) => {
  const { council, students, grades, subjects, actions } = data;

  // Calculate final result for each student
  const calculateFinalResult = (studentId: string) => {
    const studentGrades = grades.filter((g: any) => g.council_student_id === studentId);
    const relevantGrades = studentGrades.filter((g: any) => g.grade_status && g.grade_status !== "-");
    if (relevantGrades.length === 0) return { status: "N/A", label: "Sem avaliação" };
    const hasREC = relevantGrades.some((g: any) => g.grade_status === "REC");
    if (hasREC) return { status: "REC", label: "Recuperação" };
    const allAP = relevantGrades.every((g: any) => g.grade_status === "AP");
    if (allAP) return { status: "AP", label: "Aprovado" };
    return { status: "N/A", label: "Sem avaliação" };
  };

  // Import and load logo as base64
  let logoBase64 = '';
  try {
    const logoModule = await import('../assets/nova_logo_lasalle_sem_fundo.png');
    const logoUrl = logoModule.default;
    
    // Convert image to base64
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    logoBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading logo:', error);
  }

  // Create HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Conselho de Classe - ${council.grade_class}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 10px;
          line-height: 1.3;
          color: #333;
        }
        
        .header {
          position: relative;
          text-align: center;
          margin-bottom: 20px;
          padding: 10px 0 10px 120px;
          border-bottom: 2px solid #333;
          min-height: 80px;
        }
        
        .header-logo {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          max-width: 110px;
          height: auto;
        }
        
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 20px;
        }
        
        .header p {
          margin: 5px 0;
          font-size: 12px;
        }
        
        .info-section {
          margin: 20px 0;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 5px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        
        .info-item {
          padding: 5px;
        }
        
        .info-label {
          font-weight: bold;
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
        }
        
        .info-value {
          font-size: 12px;
          margin-top: 2px;
        }
        
        .section-title {
          font-size: 14px;
          font-weight: bold;
          margin: 20px 0 10px 0;
          padding-bottom: 5px;
          border-bottom: 1px solid #ddd;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 9px;
        }
        
        th, td {
          border: 1px solid #ddd;
          padding: 4px;
          text-align: left;
        }
        
        th {
          background-color: #f5f5f5;
          font-weight: bold;
          text-align: center;
          font-size: 8px;
        }
        
        .grade-ap {
          background-color: #d4edda;
          color: #155724;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
        }
        
        .grade-rec {
          background-color: #fff3cd;
          color: #856404;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
        }
        
        .grade-none {
          color: #999;
        }
        
        .result-ap {
          background-color: #d4edda;
          color: #155724;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 8px;
        }
        
        .result-rec {
          background-color: #fff3cd;
          color: #856404;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 8px;
        }
        
        .result-na {
          background-color: #e9ecef;
          color: #6c757d;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 8px;
        }
        
        .student-number {
          background-color: #e9ecef;
          padding: 2px 4px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 7px;
        }
        
        .student-name {
          font-size: 8px;
        }
        
        .actions-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 9px;
        }
        
        .actions-table th {
          background-color: #e3f2fd;
          font-weight: bold;
          padding: 8px;
          text-align: left;
          border: 1px solid #ddd;
          font-size: 10px;
        }
        
        .actions-table td {
          padding: 8px;
          border: 1px solid #ddd;
          vertical-align: top;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
        
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo La Salle" class="header-logo" />` : ''}
        <h1>Conselho de Classe</h1>
        <p><strong>La Salle Sobradinho 360</strong></p>
      </div>
      
      <div class="info-section">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Turma</div>
            <div class="info-value">${council.grade_class}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Nível Acadêmico</div>
            <div class="info-value">${council.academic_level === "EM" ? "Ensino Médio" : "Ensino Fundamental II"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Trimestre</div>
            <div class="info-value">${council.trimester}º Trimestre</div>
          </div>
          <div class="info-item">
            <div class="info-label">Data do Conselho</div>
            <div class="info-value">${format(new Date(council.council_date), "dd/MM/yyyy", { locale: ptBR })}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Ano Letivo</div>
            <div class="info-value">${council.school_years?.year || "N/A"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Total de Alunos</div>
            <div class="info-value">${students.length}</div>
          </div>
        </div>
      </div>
      
      <div class="section-title">Avaliações por Disciplina</div>
      <table>
        <thead>
          <tr>
            <th style="width: 140px;">Aluno</th>
            ${subjects.map((subject) => `
              <th style="width: 45px;">
                <div style="font-size: 7px;">${subject.subject_code}</div>
              </th>
            `).join("")}
            <th style="width: 80px; background-color: #e3f2fd;">
              <div style="font-size: 8px; font-weight: bold;">Resultado Final</div>
            </th>
          </tr>
        </thead>
        <tbody>
          ${students.map((student) => {
            const finalResult = calculateFinalResult(student.id);
            const resultClass = finalResult.status === "AP" ? "result-ap" : finalResult.status === "REC" ? "result-rec" : "result-na";
            return `
            <tr>
              <td>
                <span class="student-number">${student.student_number}</span>
                <span class="student-name">${student.student_name}</span>
              </td>
              ${subjects.map((subject) => {
                const grade = grades.find(
                  (g) => g.council_student_id === student.id && g.subject_id === subject.id
                );
                if (grade) {
                  const className = grade.grade_status === "AP" ? "grade-ap" : grade.grade_status === "REC" ? "grade-rec" : "grade-none";
                  return `<td style="text-align: center;"><span class="${className}">${grade.grade_status}</span></td>`;
                }
                return '<td style="text-align: center;"><span class="grade-none">-</span></td>';
              }).join("")}
              <td style="text-align: center; background-color: #f8f9fa;">
                <span class="${resultClass}">${finalResult.label}</span>
              </td>
            </tr>
          `;
          }).join("")}
        </tbody>
      </table>
      
      ${actions.length > 0 ? `
        <div class="section-title">Encaminhamentos e Ações</div>
        <table class="actions-table">
          <thead>
            <tr>
              <th style="width: 30%;">Tipo de Encaminhamento</th>
              <th style="width: 70%;">Descrição / Alunos</th>
            </tr>
          </thead>
          <tbody>
            ${actions.map((action) => {
              const typeLabels: Record<string, string> = {
                pais_chamados: "Pais a serem chamados",
                soe_acompanhar: "SOE deve acompanhar",
                sct_chamar: "SCT deve chamar",
                destaques: "Alunos Destaque",
              };
              const description = action.description || "";
              const studentNames = action.student_names ? `<strong>Alunos:</strong> ${action.student_names}` : "";
              const content = [description, studentNames].filter(Boolean).join("<br>");
              
              return `
                <tr>
                  <td><strong>${typeLabels[action.action_type] || action.action_type}</strong></td>
                  <td>${content || "-"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      ` : ""}
      
      <div class="footer">
        <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        <p>La Salle Sobradinho 360 - Sistema de Gestão Escolar</p>
      </div>
    </body>
    </html>
  `;

  // Create a new window for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desabilitado.");
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for content to load before printing
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
};
