#![deny(clippy::all)]

use std::io::Cursor;
use napi::bindgen_prelude::Uint8Array;
use xcap::{image::{codecs::jpeg::JpegEncoder, ImageBuffer, Rgba}, Monitor, Window};

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

fn image_to_typed_u8_jpeg(capture: &ImageBuffer<Rgba<u8>, Vec<u8>>) -> Uint8Array {
  let mut bytes: Vec<u8> = Vec::with_capacity(1_000_000);
  let _ = capture.write_with_encoder(JpegEncoder::new_with_quality(&mut Cursor::new(&mut bytes), 95));
  bytes.into()
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
        return Some(ImgWithMetadata {
          id: monitor.id(),
          name: String::from(monitor.name()),
          x: monitor.x(),
          y: monitor.y(),
          w: monitor.width(),
          h: monitor.height(),
          data: image_to_typed_u8_jpeg(&capture)
        })
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
    if window.is_minimized() { continue };
    
    let res = window.capture_image();
    match res {
      Ok(capture) => {
        return Some(ImgWithMetadata {
          id: window.id(),
          name: String::from(window.title()),
          x: window.x(),
          y: window.y(),
          w: window.width(),
          h: window.height(),
          data: image_to_typed_u8_jpeg(&capture)
        })
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