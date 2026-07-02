/**
 * multipart/form-data 요청을 fields(오브젝트) / files(배열) 로 분리
 * - 동일 fieldname 이 여러 번 오면 배열로 누적
 * - 파일은 Buffer 로 전부 읽어 메모리에 보관 (라우트에서 Prisma 트랜잭션 이후 디스크 쓰기)
 * @param {FastifyRequest} req
 * @returns {Promise<{fields:Object, files:Array<{fieldname:string,buffer:Buffer,filename:string,originalname:string,mimetype:string}>}>}
 */
export async function parseMultipart(req) {
  const parts = req.parts();

  const fields = {};
  const files = [];

  for await (const part of parts) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();

      files.push({
        fieldname: part.fieldname,
        buffer,
        filename: part.filename,
        originalname: part.filename, // 👈 추가
        mimetype: part.mimetype,
      });
    } else {
      if (fields[part.fieldname]) {
        if (Array.isArray(fields[part.fieldname])) {
          fields[part.fieldname].push(part.value);
        } else {
          fields[part.fieldname] = [fields[part.fieldname], part.value];
        }
      } else {
        fields[part.fieldname] = part.value;
      }
    }
  }

  return { fields, files };
}
