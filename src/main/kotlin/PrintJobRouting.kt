package com.pswidersk

import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.jvm.javaio.*
import java.io.File
import java.nio.file.Files
import kotlin.io.path.createTempDirectory

private val DIRECT_PRINT_EXTENSIONS = setOf("pdf", "jpg", "jpeg", "gif", "png", "txt")
private val TEXT_AS_TXT_EXTENSIONS = setOf("xml")
private val OFFICE_TO_PDF_EXTENSIONS = setOf("doc", "docx", "ppt", "pptx", "xlsx", "xmlx")

fun Route.printJobRouting() {

    post("/print-job") {
        val multipart = call.receiveMultipart()
        var printerName: String? = null
        var file: PartData.FileItem? = null
        var fileContent: ByteArray? = null
        var copies = 1
        val options = mutableListOf<String>()

        multipart.forEachPart { part ->
            when (part) {
                is PartData.FormItem -> {
                    when (part.name) {
                        "printer_name" -> printerName = part.value
                        "copies" -> copies = part.value.toIntOrNull() ?: 1
                        "options" -> options.addAll(part.value.splitByCommas())
                    }
                }

                is PartData.FileItem -> {
                    if (part.name == "file") {
                        file = part
                        fileContent = part.provider().toInputStream().readBytes()
                    }
                }

                else -> {
                    // Ignore other part types
                }
            }
            part.dispose()
        }

        if (printerName == null || file == null || fileContent == null) {
            call.respond(HttpStatusCode.BadRequest, "Missing printer_name or file")
            return@post
        }

        val originalFileName = file.originalFileName ?: "uploaded_file"
        val extension = originalFileName.substringAfterLast('.', "").lowercase()

        val allowedExtensions = DIRECT_PRINT_EXTENSIONS + TEXT_AS_TXT_EXTENSIONS + OFFICE_TO_PDF_EXTENSIONS
        if (extension !in allowedExtensions) {
            call.respond(
                HttpStatusCode.BadRequest,
                "Unsupported file type .$extension. Allowed: .pdf, .jpg, .jpeg, .gif, .png, .txt, .xml, .doc, .docx, .ppt, .pptx, .xlsx, .xmlx"
            )
            return@post
        }

        val workingDir = createTempDirectory("printamos_").toFile()
        val uploadedFile = workingDir.resolve(buildWorkingFileName(originalFileName, extension))

        var fileToPrint = uploadedFile
        try {
            uploadedFile.writeBytes(fileContent)

            fileToPrint = when {
                extension in DIRECT_PRINT_EXTENSIONS -> uploadedFile
                extension in TEXT_AS_TXT_EXTENSIONS -> normalizeTextLikeFile(uploadedFile, workingDir)
                extension in OFFICE_TO_PDF_EXTENSIONS -> convertOfficeDocumentToPdf(uploadedFile, extension, workingDir)
                else -> uploadedFile
            }

            val command = mutableListOf(
                "lp",
                "-E",
                "-d", printerName,
                "-n", copies.toString(),
            )
            options.forEach { command += listOf("-o", it) }
            command += fileToPrint.absolutePath

            val out = execCommand(command)

            if (out.success) {
                call.respond(HttpStatusCode.OK, out.output.ifEmpty { "Print job sent successfully" })
            } else {
                call.respond(HttpStatusCode.InternalServerError, out.errorMessage)
            }
        } catch (e: Exception) {
            call.respond(HttpStatusCode.InternalServerError, "Error processing print job: ${e.message}")
        } finally {
            workingDir.deleteRecursively()
        }
    }

}

private fun buildWorkingFileName(originalFileName: String, extension: String): String {
    val safeBaseName = originalFileName
        .substringBeforeLast('.', originalFileName)
        .replace(Regex("[^A-Za-z0-9._-]"), "_")
        .ifBlank { "uploaded_file" }

    val normalizedExtension = when (extension) {
        "xmlx" -> "xlsx"
        else -> extension.ifBlank { "bin" }
    }

    return "$safeBaseName.$normalizedExtension"
}

private fun normalizeTextLikeFile(sourceFile: File, workingDir: File): File {
    val textFile = workingDir.resolve(sourceFile.nameWithoutExtension + ".txt")
    sourceFile.copyTo(textFile, overwrite = true)
    return textFile
}

private fun convertOfficeDocumentToPdf(sourceFile: File, originalExtension: String, workingDir: File): File {
    val outputDir = workingDir.resolve("converted")
    outputDir.mkdirs()

    val convertCommand = listOf(
        "soffice",
        "--headless",
        "--nologo",
        "--nodefault",
        "--nolockcheck",
        "--norestore",
        "--convert-to", "pdf:writer_pdf_Export",
        "--outdir", outputDir.absolutePath,
        sourceFile.absolutePath,
    )

    val conversionResult = execCommand(convertCommand)
    if (!conversionResult.success) {
        throw IllegalStateException(
            "LibreOffice conversion failed for .${originalExtension}: ${conversionResult.errorMessage.ifBlank { conversionResult.output }}"
        )
    }

    val producedPdf = outputDir.resolve(sourceFile.nameWithoutExtension + ".pdf")
    if (!producedPdf.exists()) {
        val candidates = outputDir.listFiles()?.filter { it.extension.equals("pdf", ignoreCase = true) }.orEmpty()
        if (candidates.size == 1) {
            return candidates.first()
        }
        throw IllegalStateException("LibreOffice conversion did not produce a PDF for ${sourceFile.name}")
    }

    return producedPdf
}
