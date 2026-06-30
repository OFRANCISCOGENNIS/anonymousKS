Attribute VB_Name = "inventario"
' ============================================================
' Módulo: inventario
' Descrição: Análise de Inventário 15kV - SAP × PRJ × COM
' Versão: 1.0 (convertido de JavaScript)
' ============================================================

Option Explicit

' ── CONSTANTES ─────────────────────────────────────────────
Public Const TOL_SUBVAL As Double = 0.9
Public Const MIN_DIVERG_RS As Double = 100
Public Const PESO_REPROV As Integer = 40
Public Const PESO_ALERTA As Integer = 4
Public Const CAP_ALERTA As Integer = 24
Public Const PESO_PU As Integer = 3
Public Const CAP_PU As Integer = 18
Public Const PESO_COM As Integer = 2
Public Const CAP_COM As Integer = 18

' ── TIPOS DE DADOS ──────────────────────────────────────────

Public Type ItemNT006
    familia As String
    nt006 As String
    descr As String
    ehAncora As Boolean
    ancoraDep As String
    razaoMin As Double
    razaoMax As Double
    regra As String
End Type

Public Type ItemDado
    pep3 As String
    pep4 As String
    nota As String
    classe As String
    cod As String
    valor As Double
    desc As String
    und As String
    libSAP As String
    prjCAD As String
    tipo As String
    familia As String
    sit As String
    tipoPep As String
End Type

Public Type ItemSAP
    pep3 As String
    pep4 As String
    cod As String
    familia As String
    tipo As String
    desc As String
    libSAP As Variant
    prjCAD As Variant
    valor As Double
    sitText As String
    aprovacao As String
    motivo As String
End Type

Public Type ItemCOM
    pep4 As String
    pep3 As String
    cod As String
    desc As String
    familia As String
    nt006 As String
    ligadoA As String
    qtd As Double
    previsto As String
    status As String
    obs As String
End Type

Public Type ItemAlerta
    tipo As String
    pep3 As String
    pep4 As String
    cod As String
    desc As String
    familia As String
    valor As Double
    qtd As Double
    motivo As String
End Type

Public Type ItemRisco
    pep3 As String
    valor As Double
    situacao As String
    alertas As Integer
    divergPU As Integer
    sobrepreco As Double
    comFora As Integer
    score As Integer
    risco As String
    diagnostico As String
End Type

' ── FUNÇÕES AUXILIARES ──────────────────────────────────────

Function NormStr(s As Variant) As String
    Dim r As String
    If IsNull(s) Or s = "" Then
        NormStr = ""
        Exit Function
    End If
    r = UCase(Trim(CStr(s)))
    ' Remover acentos (simplificado - apenas maiúscula+trim)
    r = Replace(r, "Á", "A"): r = Replace(r, "À", "A"): r = Replace(r, "Ã", "A"): r = Replace(r, "Â", "A")
    r = Replace(r, "É", "E"): r = Replace(r, "È", "E"): r = Replace(r, "Ê", "E")
    r = Replace(r, "Í", "I"): r = Replace(r, "Ò", "O"): r = Replace(r, "Ó", "O"): r = Replace(r, "Õ", "O"): r = Replace(r, "Ô", "O")
    r = Replace(r, "Ú", "U"): r = Replace(r, "Ü", "U"): r = Replace(r, "Ç", "C")
    r = Replace(r, ".", ""): r = Replace(r, "/", ""): r = Replace(r, "-", ""): r = Replace(r, "_", "")
    NormStr = Trim(Replace(r, "  ", " "))
End Function

Function NormCod(v As Variant) As String
    Dim s As String
    If IsNull(v) Or v = "" Then
        NormCod = ""
        Exit Function
    End If
    s = Trim(CStr(v))
    If Right(s, 2) = ".0" Then s = Left(s, Len(s) - 2)
    NormCod = s
End Function

Function ToNum(v As Variant) As Double
    If IsNull(v) Or v = "" Then
        ToNum = 0
    Else
        On Error Resume Next
        ToNum = CDbl(v)
        If Err.Number <> 0 Then ToNum = 0
        On Error GoTo 0
    End If
End Function

Function TemPalavra(descNorm As String, termo As String) As Boolean
    Dim s As String
    s = " " & Replace(Replace(Replace(Replace(descNorm, "-", " "), "/", " "), "_", " "), ".", " ") & " "
    TemPalavra = (InStr(s, " " & termo & " ") > 0)
End Function

Function Fmt2(v As Double) As String
    Fmt2 = Format(v, "0.00")
End Function

' ── MAPA NT.006 ─────────────────────────────────────────────

Sub CriarMapaNT006(mapa As Object)
    ' Faixa de CRUZETAS (âncoras)
    Call AdicionarNT006(mapa, "133100007", "CRUZETA", "R-02", "Cruzeta concreto T 1900mm", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "133100001", "CRUZETA", "R-02", "Cruzeta concreto L 1700mm", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "133100006", "CRUZETA", "R-02", "Cruzeta concreto T 2200mm", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "133400012", "CRUZETA", "R-02", "Cruzeta PRFV 90x112,5 2,4m", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "133400003", "CRUZETA", "R-02", "Cruzeta PRFV", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "133400004", "CRUZETA", "R-02", "Cruzeta PRFV", True, "", 0, 0, "")

    ' ISOLADOR PILAR (dependente de CRUZETA)
    Call AdicionarNT006(mapa, "123140003", "ISOLADOR PILAR", "I-05", "Isolador pilar 15kV M16", False, "CRUZETA", 2, 3.5, "2-3 iso. pilar por cruzeta")
    Call AdicionarNT006(mapa, "123140016", "ISOLADOR PILAR", "I-05", "Isolador pilar 24,2kV M16", False, "CRUZETA", 2, 3.5, "2-3 iso. pilar por cruzeta")
    Call AdicionarNT006(mapa, "123140015", "ISOLADOR PILAR", "I-05", "Isolador pilar polim. 25kV", False, "CRUZETA", 2, 3.5, "2-3 iso. pilar por cruzeta")
    Call AdicionarNT006(mapa, "123140014", "ISOLADOR PILAR", "I-05", "Isolador pilar", False, "CRUZETA", 2, 3.5, "2-3 iso. pilar por cruzeta")

    ' ISOLADOR SUSPENSÃO (âncora)
    Call AdicionarNT006(mapa, "123230001", "ISOL SUSPENSAO", "I-06", "Isolador suspensao polim. 15kV", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "123230002", "ISOL SUSPENSAO", "I-06", "Isolador suspensao", True, "", 0, 0, "")

    ' ARRUELAS (dependentes de CRUZETA)
    Call AdicionarNT006(mapa, "134830013", "ARRUELA", "A-02", "Arruela quad. 38x38x3mm F18", False, "CRUZETA", 2, 9, "2-8 arruelas por cruzeta")
    Call AdicionarNT006(mapa, "134830014", "ARRUELA", "A-02", "Arruela quad. lis 18x50x3mm", False, "CRUZETA", 2, 9, "2-8 arruelas por cruzeta")
    Call AdicionarNT006(mapa, "134830051", "ARRUELA", "A-02", "Arruela red pres M18", False, "CRUZETA", 2, 9, "2-8 arruelas por cruzeta")

    ' PARAFUSOS (dependentes de CRUZETA)
    Call AdicionarNT006(mapa, "134700040", "PARAFUSO", "F-30", "Parafuso cab qd 125mm M16x2", False, "CRUZETA", 1, 8, "1-8 parafusos por cruzeta")
    Call AdicionarNT006(mapa, "134700043", "PARAFUSO", "F-30", "Parafuso cab qd 200mm M16x2", False, "CRUZETA", 1, 8, "1-8 parafusos por cruzeta")
    Call AdicionarNT006(mapa, "134700046", "PARAFUSO", "F-30", "Parafuso cab qd 250mm M16x2", False, "CRUZETA", 1, 8, "1-8 parafusos por cruzeta")
    Call AdicionarNT006(mapa, "134700047", "PARAFUSO", "F-30", "Parafuso cab qd 300mm M16x2", False, "CRUZETA", 1, 8, "1-8 parafusos por cruzeta")
    Call AdicionarNT006(mapa, "134700049", "PARAFUSO", "F-30", "Parafuso cab qd 400mm M16x2", False, "CRUZETA", 1, 8, "1-8 parafusos por cruzeta")
    Call AdicionarNT006(mapa, "134700028", "PARAFUSO", "F-30", "Parafuso cab abaul 16x45mm", False, "CRUZETA", 1, 8, "1-8 parafusos por cruzeta")
    Call AdicionarNT006(mapa, "134700030", "PARAFUSO", "F-30", "Parafuso cab abaul 16x150mm", False, "CRUZETA", 1, 8, "1-8 parafusos por cruzeta")
    Call AdicionarNT006(mapa, "134700082", "PARAFUSO", "F-30", "Parafuso rosca dupla 16x500", False, "CRUZETA", 1, 8, "1-8 parafusos por cruzeta")

    ' PINOS (dependentes de CRUZETA)
    Call AdicionarNT006(mapa, "134280005", "PINO", "F-36", "Pino iso pilar autotrav M16x2", False, "CRUZETA", 2, 3.5, "~3 pinos por cruzeta")
    Call AdicionarNT006(mapa, "134280002", "PINO", "F-37", "Pino curto suporte topo", False, "CRUZETA", 1, 2.5, "1-2 pinos curtos por cruzeta")

    ' PORCA (dependente de CRUZETA)
    Call AdicionarNT006(mapa, "134800002", "PORCA", "A-21", "Porca quad. M16x2", False, "CRUZETA", 2, 6.5, "2-6 porcas por cruzeta")

    ' SELA CRUZETA (dependente de CRUZETA)
    Call AdicionarNT006(mapa, "134380004", "SELA CRUZETA", "-", "Sela cruzeta 110x116mm", False, "CRUZETA", 2, 4, "2-3 selas por cruzeta trifasica")
    Call AdicionarNT006(mapa, "134380005", "SELA CRUZETA", "-", "Sela cruzeta", False, "CRUZETA", 2, 4, "2-3 selas por cruzeta")

    ' MAO FRANCESA
    Call AdicionarNT006(mapa, "134100006", "MAO FRANCESA", "-", "Mao francesa plana 726x38x5mm", False, "CRUZETA", 0.5, 2.5, "1-2 maos-francesas por cruzeta")

    ' GANCHO OLHAL (âncora)
    Call AdicionarNT006(mapa, "134250015", "GANCHO OLHAL", "F-13", "Gancho olhal 5000daN", True, "", 0, 0, "")

    ' MANILHA / OLHAL (dependentes de GANCHO OLHAL)
    Call AdicionarNT006(mapa, "134200006", "MANILHA", "F-22", "Manilha sapatilha 5000daN", False, "GANCHO OLHAL", 0.8, 1.2, "1 manilha por ponto de suspensao")
    Call AdicionarNT006(mapa, "134250023", "OLHAL PARAFUSO", "-", "Olhal parafuso M16 5000daN", False, "GANCHO OLHAL", 0.8, 1.2, "1 olhal por ponto de suspensao")
    Call AdicionarNT006(mapa, "134740023", "PARAFUSO OLHAL", "F-34", "Parafuso olhal M16x250mm", False, "GANCHO OLHAL", 0.8, 1.2, "1 parafuso olhal por ponto de suspensao")

    ' HASTE DE ATERRAMENTO (âncora)
    Call AdicionarNT006(mapa, "134600010", "HASTE TERRA", "F-17", "Haste aco-cobreado 14,3mm 2,4m", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "134600004", "HASTE TERRA", "F-17", "Haste aco-cobreado 12,7mm 2,4m", True, "", 0, 0, "")

    ' CONECTOR HASTE (dependente de HASTE TERRA)
    Call AdicionarNT006(mapa, "124140026", "CONEC HASTE", "M-10", "Conector cunha haste 6-16mm", False, "HASTE TERRA", 0.8, 1.2, "1 conector por haste")
    Call AdicionarNT006(mapa, "124140078", "CONEC HASTE", "M-10", "Conector aterramento p/haste", False, "HASTE TERRA", 0.8, 1.2, "1 conector por haste")
    Call AdicionarNT006(mapa, "124140011", "CONEC HASTE", "M-10", "Conector cunha haste", False, "HASTE TERRA", 0.8, 1.2, "1 conector por haste")

    ' SUPORTE PARA-RAIOS (âncora)
    Call AdicionarNT006(mapa, "134190064", "SUP PARA-RAIO", "F-47", "Suporte L para-raios 38x205", True, "", 0, 0, "")

    ' PARA-RAIOS (dependente de SUPORTE)
    Call AdicionarNT006(mapa, "104010001", "PARA-RAIO", "E-29", "Para-raios ZnO 12kV 10kA", False, "SUP PARA-RAIO", 0.8, 1.2, "1 para-raios por suporte")
    Call AdicionarNT006(mapa, "104010004", "PARA-RAIO", "E-29", "Para-raios ZnO 15kV", False, "SUP PARA-RAIO", 0.8, 1.2, "1 para-raios por suporte")

    ' CHAVE FUSÍVEL (âncora)
    Call AdicionarNT006(mapa, "105300003", "CHAVE FUSIVEL", "E-09", "Chave fusivel 15kV 100A base C", True, "", 0, 0, "")

    ' TRANSFORMADOR (âncora)
    Call AdicionarNT006(mapa, "102100035", "TRAFO", "E-45", "Trafo trifasico 13,8kV 500kVA", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "102100036", "TRAFO", "E-45", "Trafo trifasico 13,8kV", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "102100030", "TRAFO", "E-45", "Trafo monofasico", True, "", 0, 0, "")

    ' CONECTOR RAMAL (âncora)
    Call AdicionarNT006(mapa, "124010010", "CONEC RAMAL", "O-02", "Conector cunha CuEst tipo II", True, "", 0, 0, "")
    Call AdicionarNT006(mapa, "124010012", "CONEC RAMAL", "O-02", "Conector cunha CuEst tipo III", True, "", 0, 0, "")

End Sub

Sub AdicionarNT006(mapa As Object, cod As String, familia As String, nt006 As String, descr As String, _
                   ehAncora As Boolean, ancoraDep As String, razaoMin As Double, razaoMax As Double, regra As String)
    ' Esta sub seria implementada usando um Dictionary ou Collection
    ' Para simplificação, o VBA usaria estruturas diferentes
End Sub

' ── CLASSIFICAÇÃO POR DESCRIÇÃO (FALLBACK) ──────────────────

Function ClassificarDesc(descNorm As String) As ItemNT006
    Dim r As ItemNT006

    If InStr(descNorm, "CRUZETA") > 0 Then
        r.familia = "CRUZETA"
        r.nt006 = "R-02"
        r.ehAncora = True
        ClassificarDesc = r
        Exit Function
    End If

    If InStr(descNorm, "ISOLADOR") > 0 And (InStr(descNorm, "DISCO") > 0 Or InStr(descNorm, "SUSPENS") > 0) Then
        r.familia = "ISOL SUSPENSAO"
        r.nt006 = "I-06"
        r.ehAncora = True
        ClassificarDesc = r
        Exit Function
    End If

    ' ... adicionar mais classificações conforme necessário

    ClassificarDesc = r
End Function

' ── REGRAS DE NEGÓCIO ────────────────────────────────────────

Function EhAderente(fam As String, libV As String, prjV As String, rawSitNorm As String) As Boolean
    Dim isMarg As Boolean, l As Double, p As Double

    isMarg = (Left(fam, 4) = "COND") Or (Left(fam, 4) = "CABO") Or (fam = "RAMAL")

    If isMarg And libV <> "" And prjV <> "" Then
        On Error Resume Next
        l = CDbl(libV)
        p = CDbl(prjV)
        On Error GoTo 0
        If p = 0 Then
            EhAderente = (l = 0)
        Else
            EhAderente = (Abs(l - p) <= 0.1 * Abs(p))
        End If
    Else
        EhAderente = (rawSitNorm = "ADERENTE")
    End If
End Function

Function EhComCritico(famNorm As String) As Boolean
    Dim f As String
    f = Replace(famNorm, " ", "")
    EhComCritico = (InStr(f, "CHFUS") > 0 Or InStr(f, "CHAVEFUS") > 0 Or InStr(f, "PARARAIO") > 0)
End Function

' ── ENTRY POINT PRINCIPAL ────────────────────────────────────

' Esta função seria o ponto de entrada para gerar o relatório completo
Sub ExecutarAnalise()
    ' Implementação: ler dados da planilha ativa, processar, gerar relatórios
    MsgBox "Análise de Inventário 15kV" & vbCrLf & "Módulo: inventario.bas" & vbCrLf & "Versão 1.0", vbInformation
End Sub

' ────────────────────────────────────────────────────────────
' FIM DO MÓDULO
' ────────────────────────────────────────────────────────────
