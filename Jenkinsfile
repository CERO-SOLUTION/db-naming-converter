// 기존 코드에 XLSX 다운로드 추가 (이미지 빌드 전)
pipeline {
  agent any

  environment {
    SHEET_ID = '1Q98LFRr_Ka1ZyBKUJ6u1vJD67F_JHIs8eovklCX_dNY'
    GID = '1543734301'
    XLSX_FILE = 'BMS_테이블_정의_V1.1.xlsx'
    // 기존 환경변수들...
    BUILD_BRANCH = getBuildBranch(env.GIT_BRANCH)
    BUILD_COMMAND = getBuildCommand(env.GIT_BRANCH)
    DOCKER_IMAGE = ''
    DOCKER_PROJECT_NAME = 'cero'
    DOCKER_IMAGE_NAME = "db-naming-converter"
    GIT_KEY_ID = 'uinetworks-gitea-delploy-account'
    GIT_REPO_URL = 'https://github.com/CERO-SOLUTION/db-naming-converter.git'
    REGISTRY_URL = 'registry.zetra.kr'
    REGISTRY_LOGIN_INFO_ID = 'harbor_hjdev'
  }

  stages {
    stage('체크아웃') {
      steps {
        echo "작업 브랜치: ${env.GIT_BRANCH}"
        git branch: BUILD_BRANCH, credentialsId: GIT_KEY_ID, url: GIT_REPO_URL
      }
    }

    stage('Download BMS XLSX') {
      steps {
        sh """
          mkdir -p data/
          curl -L -f "https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&gid=${GID}" \\
               -o ${XLSX_FILE}
          ls -la ${XLSX_FILE}
          echo "BMS XLSX 다운로드 완료: ${XLSX_FILE}"
        """
      }
    }

    stage('이미지 빌드') {
      steps {
        script {
          // XLSX가 빌드 컨텍스트에 포함 (copy 포함)
          DOCKER_IMAGE = docker.build("${DOCKER_PROJECT_NAME}/${DOCKER_IMAGE_NAME}-${BUILD_BRANCH}", 
                                    "--build-arg BUILD_COMMAND=\"${BUILD_COMMAND}\" --build-arg XLSX_FILE=\"${XLSX_FILE}\" .")
          echo "Built: ${DOCKER_IMAGE_NAME}-${BUILD_BRANCH}"
        }
      }
    }

    // 나머지 stage들 동일 (이미지 전송, 컨테이너 배포...)
    stage('이미지 전송') {
      steps {
        script {
          docker.withRegistry('https://registry.zetra.kr', REGISTRY_LOGIN_INFO_ID) {
            DOCKER_IMAGE.push(env.BUILD_NUMBER)
            DOCKER_IMAGE.push('latest')
          }
        }
        echo "Pushed: ${DOCKER_IMAGE_NAME}-${BUILD_BRANCH}:${env.BUILD_NUMBER}"
      }
    }

    stage('컨테이너 배포') {
      when {
        expression { BUILD_BRANCH == 'dev' }
      }
      steps {
        script {
          def deployTargets = getDeployTargets(BUILD_BRANCH)
          def deployments = [:]

          for (item in deployTargets) {
            def target = item
            deployments["TARGET-${BUILD_BRANCH}"] = {
              def remote = [:]
              remote.name = target.SSH_IP
              remote.host = target.SSH_IP
              remote.allowAnyHosts = true

              if (target.SSH_MODE == 'KEYONLY') {
                withCredentials([
                  sshUserPrivateKey(credentialsId: target.SSH_KEY_ID, keyFileVariable: 'SSH_PRIVATE_KEY', usernameVariable: 'USERNAME')
                ]) {
                  remote.user = USERNAME
                  remote.identityFile = SSH_PRIVATE_KEY

                  sshCommand remote: remote, command: """
                    mkdir -p ${target.COPY_DIR}-${BUILD_BRANCH}/
                  """

                  sshPut remote: remote, from: "docker-compose.yml", into: "${target.COPY_DIR}-${BUILD_BRANCH}/", failOnError: 'true'
                  
                  sshCommand remote: remote, command: """
                    cd ${target.COPY_DIR}-${BUILD_BRANCH}/
                    DOCKER_IMAGE_NAME=${REGISTRY_URL}/${DOCKER_PROJECT_NAME}/${DOCKER_IMAGE_NAME}-${BUILD_BRANCH} DOCKER_CONTAINER_NAME=${DOCKER_IMAGE_NAME}-${BUILD_BRANCH} docker compose pull
                    DOCKER_IMAGE_NAME=${REGISTRY_URL}/${DOCKER_PROJECT_NAME}/${DOCKER_IMAGE_NAME}-${BUILD_BRANCH} DOCKER_CONTAINER_NAME=${DOCKER_IMAGE_NAME}-${BUILD_BRANCH} docker compose up -d
                  """
                }
              }
            }
          }
          parallel deployments
        }
      }
    }
  }
}
