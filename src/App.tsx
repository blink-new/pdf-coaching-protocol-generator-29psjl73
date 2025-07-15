import { useState, useEffect } from 'react'
import { blink } from './blink/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Progress } from './components/ui/progress'
import { Separator } from './components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { FileText, Upload, Sparkles, Download, FileCheck, Clock, Eye, BookOpen } from 'lucide-react'
import { toast, Toaster } from 'react-hot-toast'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } from 'docx'

interface AuthState {
  user: any
  isLoading: boolean
  isAuthenticated: boolean
}

function App() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [extractedText, setExtractedText] = useState<string>('')
  const [coachingProtocol, setCoachingProtocol] = useState<string>('')
  const [progress, setProgress] = useState(0)
  const [activeTab, setActiveTab] = useState('upload')

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setAuthState(state)
    })
    return unsubscribe
  }, [])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setExtractedText('')
      setCoachingProtocol('')
      setProgress(0)
      toast.success('PDF ausgewählt!')
    } else {
      toast.error('Bitte wählen Sie eine PDF-Datei aus.')
    }
  }

  const extractTextFromPDF = async () => {
    if (!selectedFile) return

    setIsExtracting(true)
    setProgress(25)

    try {
      const text = await blink.data.extractFromBlob(selectedFile)
      setExtractedText(text)
      setProgress(50)
      toast.success('PDF erfolgreich analysiert!')
    } catch (error) {
      toast.error('Fehler beim Extrahieren des Textes.')
      console.error('Error:', error)
    } finally {
      setIsExtracting(false)
    }
  }

  const generateCoachingProtocol = async () => {
    if (!extractedText) return

    setIsGenerating(true)
    setProgress(75)

    try {
      const { text } = await blink.ai.generateText({
        prompt: `Erstelle ein professionelles Coaching-Protokoll basierend auf dem folgenden Text aus einer PDF-Datei. Das Protokoll soll strukturiert sein und folgende Bereiche enthalten:

1. **Zusammenfassung der Sitzung**
2. **Hauptthemen und Anliegen**
3. **Erkenntnisse und Aha-Momente**
4. **Vereinbarte Ziele**
5. **Nächste Schritte und Maßnahmen**
6. **Reflexion und Feedback**
7. **Termine und Folgetermine**

Bitte formatiere das Protokoll professionell in Markdown-Format mit klaren Überschriften, Aufzählungen und strukturierten Inhalten. Das Protokoll sollte präzise, umsetzbar und für den Coachee verständlich sein.

Hier ist der Text aus der PDF:

${extractedText}`,
        model: 'gpt-4o-mini',
        maxTokens: 2000
      })
      
      setCoachingProtocol(text)
      setProgress(100)
      toast.success('Coaching-Protokoll erfolgreich generiert!')
    } catch (error) {
      toast.error('Fehler beim Generieren des Protokolls.')
      console.error('Error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadProtocol = (content?: string, filename?: string) => {
    const protocolContent = content || coachingProtocol
    if (!protocolContent) return
    
    const blob = new Blob([protocolContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `coaching-protokoll-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Protokoll heruntergeladen!')
  }

  const downloadWordDocument = async (content?: string, filename?: string) => {
    const protocolContent = content || coachingProtocol
    if (!protocolContent) return

    try {
      // Parse the markdown content and convert to Word document structure
      const lines = protocolContent.split('\n')
      const paragraphs: Paragraph[] = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        if (line.startsWith('# ')) {
          // Main heading
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line.substring(2), bold: true, size: 32 })],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }))
        } else if (line.startsWith('## ')) {
          // Section heading
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line.substring(3), bold: true, size: 28, underline: { type: UnderlineType.SINGLE } })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 }
          }))
        } else if (line.startsWith('### ')) {
          // Subsection heading
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line.substring(4), bold: true, size: 24 })],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 }
          }))
        } else if (line.startsWith('- **') && line.includes(':**')) {
          // Bold list item with description
          const match = line.match(/- \*\*(.*?):\*\*(.*)/);
          if (match) {
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({ text: '• ', bold: true }),
                new TextRun({ text: match[1] + ': ', bold: true }),
                new TextRun({ text: match[2] })
              ],
              spacing: { after: 100 }
            }))
          }
        } else if (line.startsWith('- ')) {
          // Regular list item
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({ text: '• ', bold: true }),
              new TextRun({ text: line.substring(2) })
            ],
            spacing: { after: 100 }
          }))
        } else if (line.startsWith('**') && line.endsWith('**')) {
          // Bold text
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line.substring(2, line.length - 2), bold: true })],
            spacing: { after: 100 }
          }))
        } else if (line.startsWith('---')) {
          // Separator line
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: '_______________________________________________' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 }
          }))
        } else if (line.match(/^\d+\./)) {
          // Numbered list
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 100 }
          }))
        } else if (line.length > 0) {
          // Regular paragraph
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 100 }
          }))
        } else {
          // Empty line for spacing
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: '' })],
            spacing: { after: 100 }
          }))
        }
      }

      // Create the Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      })

      // Generate and download the document
      const buffer = await Packer.toBuffer(doc)
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename?.replace('.md', '.docx') || `coaching-protokoll-${new Date().toISOString().split('T')[0]}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Word-Dokument heruntergeladen!')
    } catch (error) {
      console.error('Error creating Word document:', error)
      toast.error('Fehler beim Erstellen des Word-Dokuments')
    }
  }

  // Vorgefertigtes Protokoll aus den PDFs
  const predefinedProtocol = `# Coaching-Protokoll

## Sitzungsdetails
- **Teilnehmer:** Annett Endres
- **Termin:** 09. Juli 2025, 15:00 - 16:00 Uhr
- **Nächster Termin:** 15. Juli 2025, 17:00 Uhr
- **Art:** Blumenfeld Coaching - SpoA (Teams-Meeting)
- **Dauer:** 60 Minuten

---

## Aktueller Status und Befinden

### Körperliche Verfassung
- **Kardiologische Abklärung:** Wurde durchgeführt, alles in Ordnung, alle 3 Monate Kontrolle
- **Endokrinologische Abklärung:** Wurde durchgeführt, alles in Ordnung → Welche Abstände für weitere Kontrollen?
- **Integrative Medizin:** Hautkontakt aufgenommen, intensive 14-Tage-Kur geplant (nicht möglich wegen Therapie)

### Aktuelle Behandlung
- **Status quo:** Parallel Radio + Chemotherapie
- **Aktuelle Phase:** Derzeit Pause weil Leukozyten zu niedrig (14 Tage jetzt → macht sich Sorgen)
- **Neue Sorgen:** Bekommt - hat nicht gehalten
- **Überlegung:** Liegt an einer US-Studie teilzunehmen
- **Entscheidung:** Soll einhalten

---

## Hauptthemen der Sitzung

### 1. Medizinische Situation
- Liest Studien und lässt sich verunsichern
- Patientin hat Stress dadurch
- Kontakt dringlich zu Gassmann → Immunstatus + Therapie
- Dr. Rolf Eichinger BOT-Behandlung

### 2. Studie US
- Patientin bekam Informationen von Patientin
- Dr. Rosen → wird Hyperthermie durchgeführt

### 3. Sportliche Aktivitäten
**Aktuelle Routine:**
- 4x pro Woche: Ausdauer, 2x Ironman
- 4x pro Woche: Einheit 1 Stunde Therapien
- Werden von der Patientin übernommen
- Reflexe: Gesundheit, Größe, Regeneration/Heilungsphase → Nacht, guter Schlaf
- 160 Maximal-Puls

### 4. Nächster Termin
**Bioloide:** 15 Minuten
- Sport-Präsentation
- Mentale Fragen
- 22.7.25 um 15 Uhr

---

## Erkenntnisse und Reflexion

### Positive Entwicklungen
- Regelmäßige sportliche Aktivität wird gut durchgehalten
- Medizinische Abklärungen zeigen positive Ergebnisse
- Aktive Auseinandersetzung mit Behandlungsoptionen

### Herausforderungen
- Verunsicherung durch Studien und externe Informationen
- Sorgen wegen Behandlungspause
- Entscheidungsfindung bezüglich US-Studie

### Empfehlungen
- Fokus, Konzentration und Glaube an sich als Beispiel der normalen Übernahme mit Fokus auf die derzeitige Situation
- Übergang zur Anregung der Leukozyten:
  - Yogablock/Steißbein-Übung: 20 Min 2x täglich
  - + Bedarfs Entspannung Musik
  - + Ungestörtsein
  - + Atemübungen (Hinweis auf den Instagram Newsletter + Instagram-Post)

---

## Vereinbarte Maßnahmen

### Sofortige Schritte
1. **EA 6-8 - Kudowa 4 - AA 8-10**
2. **+ Einnahme 3x tägl. Bio Brain + Glo**
3. **Kontrolle über Blutabnahme im KH**
4. **Disziplinierte Durchführung bis zu unserer nächsten Sitzung**

### Langfristige Ziele
- Stabilisierung der Leukozyten-Werte
- Stressreduktion durch gezielte Entspannungstechniken
- Klarheit bezüglich weiterer Behandlungsoptionen

---

## Nächste Schritte

### Bis zum nächsten Termin (15.07.2025)
1. Tägliche Entspannungsübungen durchführen
2. Regelmäßige Blutkontrollen
3. Entscheidung bezüglich US-Studie treffen
4. Sportprogramm beibehalten

### Folgetermin
- **Datum:** 15. Juli 2025, 17:00 Uhr
- **Schwerpunkte:** 
  - Sport-Präsentation
  - Mentale Fragen
  - Auswertung der Entspannungsübungen
  - Besprechung der Blutwerte

---

## Notizen für den Coach
- Patientin zeigt hohe Eigenverantwortung
- Neigt zur Verunsicherung durch externe Informationen
- Benötigt Unterstützung bei Entscheidungsfindung
- Sportliche Aktivität als wichtige Ressource nutzen

---

*Protokoll erstellt am: 15. Juli 2025*  
*Coach: [Name des Coaches]*  
*Nächste Überprüfung: 15. Juli 2025*`

  if (authState.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Lädt...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-purple-600 rounded-full">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">PDF Coaching-Protokoll Generator</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Lade deine PDF-Datei hoch und erhalte ein professionelles Coaching-Protokoll mit KI-Unterstützung
          </p>
        </div>

        {/* User Info */}
        <div className="mb-8 text-center">
          <p className="text-sm text-gray-600">
            Angemeldet als: <span className="font-semibold text-purple-600">{authState.user?.email}</span>
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              PDF hochladen
            </TabsTrigger>
            <TabsTrigger value="example" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Beispiel-Protokoll
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            {/* Progress Bar */}
            {progress > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Fortschritt</span>
                  <span className="text-sm font-medium text-gray-700">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

        {/* File Upload */}
        <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-purple-600" />
              PDF-Datei hochladen
            </CardTitle>
            <CardDescription>
              Wähle eine PDF-Datei aus, die du in ein Coaching-Protokoll umwandeln möchtest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label htmlFor="pdf-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-purple-300 border-dashed rounded-lg cursor-pointer bg-purple-50 hover:bg-purple-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-purple-500" />
                    <p className="mb-2 text-sm text-gray-700">
                      <span className="font-semibold">Klicke zum Hochladen</span> oder ziehe die Datei hierher
                    </p>
                    <p className="text-xs text-gray-500">PDF-Dateien (MAX. 10MB)</p>
                  </div>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
              
              {selectedFile && (
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">{selectedFile.name}</p>
                      <p className="text-sm text-green-600">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button 
                    onClick={extractTextFromPDF}
                    disabled={isExtracting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isExtracting ? 'Analysiere...' : 'Text extrahieren'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Text Extraction Result */}
        {extractedText && (
          <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Extrahierter Text
              </CardTitle>
              <CardDescription>
                Text erfolgreich aus der PDF extrahiert. Klicke auf "Protokoll generieren" um fortzufahren.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto border">
                <pre className="text-sm whitespace-pre-wrap text-gray-700">
                  {extractedText.substring(0, 500)}...
                </pre>
              </div>
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={generateCoachingProtocol}
                  disabled={isGenerating}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generiere Protokoll...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Coaching-Protokoll generieren
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generated Protocol */}
        {coachingProtocol && (
          <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-600" />
                Generiertes Coaching-Protokoll
              </CardTitle>
              <CardDescription>
                Dein professionelles Coaching-Protokoll wurde erfolgreich erstellt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-800 font-sans leading-relaxed">
                    {coachingProtocol}
                  </pre>
                </div>
              </div>
              <Separator className="my-6" />
              <div className="flex justify-center gap-4">
                <Button
                  onClick={() => downloadProtocol()}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Als Markdown (.md)
                </Button>
                <Button
                  onClick={() => downloadWordDocument()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  Als Word (.docx)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

          </TabsContent>

          <TabsContent value="example" className="mt-6">
            {/* Example Protocol */}
            <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-green-600" />
                  Beispiel-Protokoll aus Ihren PDFs
                </CardTitle>
                <CardDescription>
                  Hier ist das strukturierte Coaching-Protokoll, das aus Ihren handgeschriebenen Notizen erstellt wurde.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white p-6 rounded-lg border shadow-sm max-h-96 overflow-y-auto">
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-gray-800 font-sans leading-relaxed text-sm">
                      {predefinedProtocol}
                    </pre>
                  </div>
                </div>
                <Separator className="my-6" />
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={() => downloadProtocol(predefinedProtocol, 'coaching-protokoll-annett-endres.md')}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Als Markdown (.md)
                  </Button>
                  <Button
                    onClick={() => downloadWordDocument(predefinedProtocol, 'coaching-protokoll-annett-endres.docx')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
                  >
                    <FileText className="h-5 w-5 mr-2" />
                    Als Word (.docx)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500">
          <p>Powered by Blink AI - Professionelle Coaching-Protokolle in Sekunden</p>
        </div>
      </div>
    </div>
  )
}

export default App