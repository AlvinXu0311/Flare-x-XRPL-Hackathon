const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class S3Service {
  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      },
      ...(process.env.AWS_ENDPOINT && {
        endpoint: process.env.AWS_ENDPOINT,
        forcePathStyle: true
      })
    });

    this.bucketName = process.env.S3_BUCKET_NAME || 'xrpl-medical-records';
    this.isLocal = !process.env.AWS_ACCESS_KEY_ID || process.env.NODE_ENV === 'development';

    if (this.isLocal) {
      this.localStoragePath = path.join(process.cwd(), 'uploads');
      this.ensureLocalStorage();
    }
  }

  ensureLocalStorage() {
    if (!fs.existsSync(this.localStoragePath)) {
      fs.mkdirSync(this.localStoragePath, { recursive: true });
      console.log('📁 Created local storage directory:', this.localStoragePath);
    }
  }

  generateFileKey(patientInfo, fileExtension) {
    const timestamp = new Date().toISOString().split('T')[0];
    const random = crypto.randomBytes(8).toString('hex');
    const sanitizedName = `${patientInfo.firstName}_${patientInfo.lastName}`
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();

    return `evaluations/${timestamp}/${sanitizedName}_${random}${fileExtension}`;
  }

  async uploadFile(fileBuffer, fileKey, contentType, metadata = {}) {
    try {
      if (this.isLocal) {
        return await this.uploadFileLocal(fileBuffer, fileKey, contentType, metadata);
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString()
        },
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD_IA'
      });

      const result = await this.client.send(command);

      return {
        success: true,
        fileKey,
        etag: result.ETag,
        location: `s3://${this.bucketName}/${fileKey}`,
        url: await this.getSignedDownloadUrl(fileKey),
        metadata: {
          bucket: this.bucketName,
          key: fileKey,
          contentType,
          size: fileBuffer.length,
          uploadedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  async uploadFileLocal(fileBuffer, fileKey, contentType, metadata = {}) {
    try {
      const filePath = path.join(this.localStoragePath, fileKey);
      const directory = path.dirname(filePath);

      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      fs.writeFileSync(filePath, fileBuffer);

      const metadataPath = filePath + '.meta';
      const fileMetadata = {
        contentType,
        size: fileBuffer.length,
        uploadedAt: new Date().toISOString(),
        ...metadata
      };
      fs.writeFileSync(metadataPath, JSON.stringify(fileMetadata, null, 2));

      return {
        success: true,
        fileKey,
        location: filePath,
        url: `file://${filePath}`,
        metadata: fileMetadata
      };
    } catch (error) {
      console.error('Local file upload error:', error);
      throw new Error(`Local file upload failed: ${error.message}`);
    }
  }

  async downloadFile(fileKey) {
    try {
      if (this.isLocal) {
        return await this.downloadFileLocal(fileKey);
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      });

      const result = await this.client.send(command);
      const chunks = [];

      for await (const chunk of result.Body) {
        chunks.push(chunk);
      }

      const fileBuffer = Buffer.concat(chunks);

      return {
        success: true,
        fileBuffer,
        contentType: result.ContentType,
        metadata: result.Metadata,
        lastModified: result.LastModified,
        etag: result.ETag
      };
    } catch (error) {
      console.error('S3 download error:', error);
      throw new Error(`File download failed: ${error.message}`);
    }
  }

  async downloadFileLocal(fileKey) {
    try {
      const filePath = path.join(this.localStoragePath, fileKey);
      const metadataPath = filePath + '.meta';

      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const fileBuffer = fs.readFileSync(filePath);

      let metadata = {};
      let contentType = 'application/octet-stream';

      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
        contentType = metadata.contentType || contentType;
      }

      return {
        success: true,
        fileBuffer,
        contentType,
        metadata,
        lastModified: fs.statSync(filePath).mtime
      };
    } catch (error) {
      console.error('Local file download error:', error);
      throw new Error(`Local file download failed: ${error.message}`);
    }
  }

  async deleteFile(fileKey) {
    try {
      if (this.isLocal) {
        return await this.deleteFileLocal(fileKey);
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      });

      await this.client.send(command);

      return {
        success: true,
        deletedKey: fileKey
      };
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  async deleteFileLocal(fileKey) {
    try {
      const filePath = path.join(this.localStoragePath, fileKey);
      const metadataPath = filePath + '.meta';

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }

      return {
        success: true,
        deletedKey: fileKey
      };
    } catch (error) {
      console.error('Local file delete error:', error);
      throw new Error(`Local file deletion failed: ${error.message}`);
    }
  }

  async getSignedDownloadUrl(fileKey, expiresIn = 3600) {
    try {
      if (this.isLocal) {
        return `http://localhost:${process.env.PORT || 3000}/api/files/download/${encodeURIComponent(fileKey)}`;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  async getSignedUploadUrl(fileKey, contentType, expiresIn = 3600) {
    try {
      if (this.isLocal) {
        return `http://localhost:${process.env.PORT || 3000}/api/files/upload-presigned`;
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        ContentType: contentType
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  async listFiles(prefix = '', maxKeys = 100) {
    try {
      if (this.isLocal) {
        return await this.listFilesLocal(prefix);
      }

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys
      });

      const result = await this.client.send(command);

      return {
        success: true,
        files: result.Contents?.map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          etag: obj.ETag
        })) || [],
        isTruncated: result.IsTruncated,
        continuationToken: result.NextContinuationToken
      };
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async listFilesLocal(prefix = '') {
    try {
      const searchPath = path.join(this.localStoragePath, prefix);
      const files = [];

      const walkDir = (dir, prefix = '') => {
        if (!fs.existsSync(dir)) return;

        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (item.endsWith('.meta')) continue;

          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            walkDir(itemPath, path.join(prefix, item));
          } else {
            files.push({
              key: path.join(prefix, item).replace(/\\/g, '/'),
              size: stat.size,
              lastModified: stat.mtime
            });
          }
        }
      };

      walkDir(searchPath, prefix);

      return {
        success: true,
        files,
        isTruncated: false
      };
    } catch (error) {
      console.error('Error listing local files:', error);
      return {
        success: true,
        files: []
      };
    }
  }

  getBucketInfo() {
    return {
      bucketName: this.bucketName,
      region: process.env.AWS_REGION || 'us-east-1',
      isLocal: this.isLocal,
      localPath: this.isLocal ? this.localStoragePath : null
    };
  }

  isConfigured() {
    return this.isLocal || (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  }
}

module.exports = new S3Service();