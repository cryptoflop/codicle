#![deny(clippy::all)]

use std::io::Cursor;
use napi::bindgen_prelude::Uint8Array;
use xcap::{image::{codecs::jpeg::{JpegEncoder, JpegDecoder}, ImageBuffer, ImageDecoder, Rgba}, Monitor, Window};

#[macro_use]
extern crate napi_derive;

#[napi(object)]
pub struct ImgWithMetadata {
  pub id: u32,
  pub name: String,
  pub x: i32,
  pub y: i32,
  pub w: u32,
  pub h: u32,
  pub data: Uint8Array
}

fn image_to_typed_u8_jpeg(capture: &ImageBuffer<Rgba<u8>, Vec<u8>>) -> Result<Uint8Array, &str> {
  let c = std::panic::catch_unwind(move || -> std::io::Result<Vec<u8>> {
    let mut enc_bytes = Vec::with_capacity(1_000_000);
    let _ = capture.write_with_encoder(JpegEncoder::new_with_quality(&mut Cursor::new(&mut enc_bytes), 95));

    let mut enc_cursor = Cursor::new(&mut enc_bytes);
    let decoder = JpegDecoder::new(&mut enc_cursor).unwrap();
    let mut dec_bytes: Vec<u8> = vec![0; (decoder.total_bytes()).try_into().unwrap()];
    let _ = decoder.read_image(dec_bytes.as_mut_slice());

    let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);

    comp.set_size(capture.width().try_into().unwrap(), capture.height().try_into().unwrap());

    let mut comp = comp.start_compress(Vec::new())?;

    comp.write_scanlines(&dec_bytes[..])?;

    Ok(comp.finish()?)
  });

  return match c {
    Ok(bytes) => Ok(bytes.unwrap().into()),
    Err(err) => {
      panic!("{:?}", err.downcast_ref::<String>());
    },
  }
}

#[napi]
pub fn num_screens() -> u32 {
  Monitor::all().unwrap().len().try_into().unwrap()
}

#[napi]
pub fn capture_screen(n: u32) -> Option<ImgWithMetadata> {
  let monitors = Monitor::all().unwrap();

  let mut i: u32 = 0;
  for monitor in monitors {
    if i != n { continue }; i += 1;
    let res = monitor.capture_image();
    match res {
      Ok(capture) => {
        return match image_to_typed_u8_jpeg(&capture) {
          Ok(bytes) => Some(ImgWithMetadata {
            id: monitor.id(),
            name: String::from(monitor.name()),
            x: monitor.x(),
            y: monitor.y(),
            w: monitor.width(),
            h: monitor.height(),
            data: bytes
          }),
          Err(_) => continue
        }
      },
      Err(_) => {
        continue
      },
    }
  }

  None
}

#[napi]
pub fn focused_window_id() -> Option<u32> {
  let windows = Window::all().unwrap();

  for window in windows {
    if window.is_minimized() { continue };

    let res = window.capture_image();
    match res {
      Ok(_) => {
        return Some(window.id())
      },
      Err(_) => {
        continue
      }
    }
  }

  None
}

#[napi]
pub fn capture_window(id: u32) -> Option<ImgWithMetadata> {
  let windows = Window::all().unwrap();

  for window in windows {
    if window.id() != id { continue; }
    if window.is_minimized() { continue }
    
    let res = window.capture_image();
    match res {
      Ok(capture) => {
        return match image_to_typed_u8_jpeg(&capture) {
          Ok(bytes) => Some(ImgWithMetadata {
            id: window.id(),
            name: String::from(window.title()),
            x: window.x(),
            y: window.y(),
            w: window.width(),
            h: window.height(),
            data: bytes
          }),
          Err(err) => {
            print!("{}", err);
            None
          }
        }
      },
      Err(_) => {
        continue
      }
    }
  }

  None
}




// fn overlay() {
  // let mut ss: RgbaImage = window.capture_image().unwrap().convert();
  // ss = imageops::resize(&ss, ss.width() / 4, ss.height() / 4, imageops::FilterType::Lanczos3);

  // let mut img = ImageBuffer::from_fn(1920 / 2, 1080 / 2, |_, _| image::Rgba([15, 35, 200, 255]));
  // imageops::overlay(&mut img, &ss, 128, 128);
// }