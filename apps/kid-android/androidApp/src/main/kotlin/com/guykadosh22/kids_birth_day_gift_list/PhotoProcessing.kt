package com.guykadosh22.kids_birth_day_gift_list

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import java.io.ByteArrayOutputStream

/** Turns a picked/taken picture into a small square JPEG for the profile photo (keeps uploads tiny and private). */
object PhotoProcessing {
    private const val SIZE = 320

    fun fromUri(context: Context, uri: Uri): ByteArray? {
        val bitmap = if (Build.VERSION.SDK_INT >= 28) {
            // ImageDecoder applies EXIF rotation and lets us downsample while decoding
            ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, info, _ ->
                val scale = maxOf(1, minOf(info.size.width, info.size.height) / (SIZE * 2))
                decoder.setTargetSize(info.size.width / scale, info.size.height / scale)
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            }
        } else {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            val sample = maxOf(1, minOf(bounds.outWidth, bounds.outHeight) / (SIZE * 2))
            context.contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
            }
        } ?: return null
        return toSquareJpeg(bitmap)
    }

    fun toSquareJpeg(src: Bitmap): ByteArray {
        val side = minOf(src.width, src.height)
        val cropped = Bitmap.createBitmap(src, (src.width - side) / 2, (src.height - side) / 2, side, side)
        val scaled = Bitmap.createScaledBitmap(cropped, SIZE, SIZE, true)
        return ByteArrayOutputStream().use { out ->
            scaled.compress(Bitmap.CompressFormat.JPEG, 85, out)
            out.toByteArray()
        }
    }
}
